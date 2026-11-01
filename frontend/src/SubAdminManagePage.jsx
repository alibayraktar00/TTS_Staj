import { useState, useEffect } from 'react';
import api from './api';

const STATUS_LABELS  = { open: 'Açık', in_progress: 'İşlemde', pending: 'Beklemede', resolved: 'Çözüldü' };
const STATUS_COLORS  = { open: '#F59E0B', in_progress: '#1D9E75', pending: '#0EA5E9', resolved: '#10B981' };

export default function SubAdminManagePage() {
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');

  useEffect(() => {
    fetchAssigned();
  }, []);

  const fetchAssigned = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/assigned-tickets');
      setAssignedTickets(data.tickets || []);
    } catch {
      setError('Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────── Render ─────────────── */
  return (
    <div style={S.page}>
      {/* Başlık */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>👥 Yardımcı Admin - Görev Dağılımı</h1>
          <p style={S.sub}>Hangi yardımcı admine hangi taleplerin atandığını buradan takip edebilirsiniz.</p>
        </div>
        <button style={S.refreshBtn} onClick={fetchAssigned}>🔄 Yenile</button>
      </div>

      <div style={S.card}>
        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.center}>Yükleniyor...</div>
        ) : assignedTickets.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 600, color: '#1E293B' }}>Henüz atanmış talep yok</div>
            <div style={{ color: '#64748B', fontSize: 14 }}>Talepler listesinden yardımcı adminlere talep atayabilirsiniz.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>
                  {['Yardımcı Admin', 'Talep ID', 'Başlık', 'Kategori', 'Talep Eden', 'Durum', 'Tarih'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedTickets.map(t => (
                  <tr key={t.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    
                    <td style={{ ...S.td, fontWeight: 700, color: '#185FA5' }}>
                      👤 {t.atanan_sub_admin}
                    </td>
                    <td style={S.td}>#{t.id}</td>
                    <td style={{ ...S.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {t.title}
                    </td>
                    <td style={S.td}>{t.kategori}</td>
                    <td style={S.td}>{t.kullanici}</td>
                    <td style={S.td}>
                      <span style={{ ...S.chip, background: STATUS_COLORS[t.status] || '#64748B' }}>
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                    <td style={S.td}>{new Date(t.created_at).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Stiller ─────────────────────────────────────────────── */
const S = {
  page:       { padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 },
  title:      { fontSize: 26, fontWeight: 700, margin: 0, color: '#0F172A' },
  sub:        { margin: '6px 0 0', color: '#475569', fontSize: 14 },
  card:       { background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px rgba(15,23,42,0.07)', padding: '1.75rem', marginBottom: '1.5rem' },
  refreshBtn: { background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer', color: '#475569', fontWeight: 600, fontFamily: 'inherit' },
  center:     { textAlign: 'center', color: '#64748B', padding: '3rem' },
  empty:      { textAlign: 'center', color: '#64748B', padding: '3rem', background: '#F8FAFC', borderRadius: 14 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: '1rem' },
  th:         { textAlign: 'left', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', borderBottom: '1px solid #E2E8F0' },
  td:         { padding: '14px', borderBottom: '1px solid #F1F5F9', color: '#1F2937', fontSize: 14 },
  chip:       { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700 },
};

