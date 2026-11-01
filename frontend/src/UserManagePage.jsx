import { useState, useEffect } from 'react';
import api from './api';

const ROLE_LABELS = { admin: 'Admin', manager: 'Yönetici', sub_admin: 'Yardımcı Admin', user: 'Kullanıcı' };
const ROLE_COLORS = { admin: '#7C3AED', manager: '#185FA5', sub_admin: '#0C8599', user: '#64748B' };

export default function UserManagePage({ user: currentUser }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [savingId, setSavingId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id, patch) => {
    setSavingId(id);
    setError('');
    try {
      const { data } = await api.patch(`/users/${id}`, patch);
      setUsers(prev => prev.map(u => (u.id === id ? data.user : u)));
    } catch (err) {
      setError(err.response?.data?.message || 'Güncelleme başarısız.');
    } finally {
      setSavingId(null);
    }
  };

  const visibleUsers = roleFilter ? users.filter(u => u.role === roleFilter) : users;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>👥 Kullanıcı Yönetimi</h1>
          <p style={S.sub}>Kullanıcıların rolünü değiştirin veya hesaplarını aktif/pasif yapın.</p>
        </div>
        <button style={S.refreshBtn} onClick={fetchUsers}>🔄 Yenile</button>
      </div>

      <div style={S.card}>
        <div style={S.filterRow}>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={S.select}>
            <option value="">Tüm Roller</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.center}>Yükleniyor...</div>
        ) : visibleUsers.length === 0 ? (
          <div style={S.empty}>Kullanıcı bulunamadı.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr>
                  {['ID', 'Kullanıcı Adı', 'E-posta', 'Departman', 'Rol', 'Durum', 'Son Giriş'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id}>
                      <td style={S.td}>{u.id}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{u.username}</td>
                      <td style={S.td}>{u.email}</td>
                      <td style={S.td}>{u.department || '—'}</td>
                      <td style={S.td}>
                        {isSelf ? (
                          <span style={{ ...S.chip, background: ROLE_COLORS[u.role] || '#64748B' }}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            disabled={savingId === u.id}
                            onChange={e => updateUser(u.id, { role: e.target.value })}
                            style={S.roleSelect}
                          >
                            {Object.entries(ROLE_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={S.td}>
                        {isSelf ? (
                          <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>
                        ) : (
                          <button
                            onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                            disabled={savingId === u.id}
                            style={{
                              ...S.statusBtn,
                              color: u.is_active ? '#065F46' : '#991B1B',
                              background: u.is_active ? '#ECFDF5' : '#FEF2F2',
                              borderColor: u.is_active ? '#A7F3D0' : '#FECACA',
                            }}
                          >
                            {u.is_active ? 'Aktif' : 'Pasif'}
                          </button>
                        )}
                      </td>
                      <td style={S.td}>{u.last_login ? new Date(u.last_login).toLocaleString('tr-TR') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page:       { padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 },
  title:      { fontSize: 26, fontWeight: 700, margin: 0, color: '#0F172A' },
  sub:        { margin: '6px 0 0', color: '#475569', fontSize: 14 },
  card:       { background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px rgba(15,23,42,0.07)', padding: '1.75rem' },
  refreshBtn: { background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer', color: '#475569', fontWeight: 600, fontFamily: 'inherit' },
  filterRow:  { display: 'flex', gap: 12, marginBottom: '1.25rem' },
  select:     { minWidth: 180, borderRadius: 10, border: '1px solid #CBD5E1', padding: '10px 12px', fontSize: 14, color: '#1F2937', background: '#fff' },
  center:     { textAlign: 'center', color: '#64748B', padding: '3rem' },
  empty:      { textAlign: 'center', color: '#64748B', padding: '3rem', background: '#F8FAFC', borderRadius: 14 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: '1rem' },
  th:         { textAlign: 'left', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', borderBottom: '1px solid #E2E8F0' },
  td:         { padding: '12px 14px', borderBottom: '1px solid #F1F5F9', color: '#1F2937', fontSize: 14 },
  chip:       { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700 },
  roleSelect: { borderRadius: 8, border: '1px solid #CBD5E1', padding: '6px 10px', fontSize: 13, color: '#1F2937', background: '#fff' },
  statusBtn:  { border: '1px solid', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
};
