import { useEffect, useState } from 'react';
import api from './api';

const STATUS_LABELS = {
  open: 'Açık',
  in_progress: 'İşlemde',
  pending: 'Beklemede',
  resolved: 'Çözüldü'
};

const STATUS_COLORS = {
  open: '#F59E0B',
  in_progress: '#1D9E75',
  pending: '#0EA5E9',
  resolved: '#10B981'
};

export default function TicketListPage({ onViewTicket }) {
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 15;

  // Atama Modal State
  const [assignModal, setAssignModal] = useState(null); // { ticketId, currentSubAdmin }
  const [assigningId, setAssigningId] = useState('');   // seçilen sub admin id
  const [assigning,  setAssigning]   = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchSubAdmins();
    fetchTickets(1);
  }, []);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      fetchTickets(1);
    }
  }, [statusFilter, typeFilter, categoryFilter]);

  useEffect(() => {
    fetchTickets(page);
  }, [page]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.categories);
    } catch (err) {
      console.error(err);
      setError('Kategoriler yüklenirken hata oluştu.');
    }
  };

  const fetchSubAdmins = async () => {
    try {
      const { data } = await api.get('/sub-admins');
      setSubAdmins(data.subAdmins || []);
    } catch (err) {
      console.error('Sub admins yüklenemedi:', err);
    }
  };

  const handleAssign = async () => {
    if (!assignModal) return;
    setAssigning(true);
    setAssignError('');
    try {
      await api.put(`/tickets/${assignModal.ticketId}/assign`, {
        subAdminId: assigningId ? Number(assigningId) : null,
      });
      setAssignModal(null);
      setAssigningId('');
      fetchTickets(page); // listeyi yenile
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Atama yapılamadı.');
    } finally {
      setAssigning(false);
    }
  };

  const fetchTickets = async (targetPage = 1) => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/tickets', {
        params: {
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          category: categoryFilter || undefined,
          page: targetPage,
          limit: pageSize
        }
      });
      setTickets(data.tickets);
      setTotal(data.total || 0);
      setPage(data.page || targetPage);
    } catch (err) {
      console.error(err);
      setError('Talepler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // ── Atama Modalı ──────────────────────────────────────────────────────────
  const openAssignModal = (e, ticket) => {
    e.stopPropagation(); // satır click'ini önle
    setAssignModal({ ticketId: ticket.id, currentSubAdmin: ticket.atanan_sub_admin || null });
    setAssigningId(ticket.assigned_sub_admin_id ? String(ticket.assigned_sub_admin_id) : '');
    setAssignError('');
  };

  return (
  <>
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <div>
            <h1 style={styles.title}>Talepler</h1>
            <p style={styles.subtitle}>Tüm talepler burada listelenir. Durum ve kategoriye göre filtreleyebilirsiniz.</p>
          </div>
        </div>

        <div style={styles.filterRow}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">Tüm Durumlar</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">Tüm Talep Tipleri</option>
            <option value="DONANIM">Donanım</option>
            <option value="YAZILIM">Yazılım</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Başlık</th>
                <th style={styles.th}>Talep Tipi</th>
                <th style={styles.th}>Kategori</th>
                <th style={styles.th}>Durum</th>
                <th style={styles.th}>Kullanıcı</th>
                <th style={styles.th}>Atanan YA</th>
                <th style={styles.th}>Oluşturulma</th>
                <th style={styles.th}>Atama</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={styles.loadingRow}>Yükleniyor...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="9" style={styles.emptyRow}>Henüz talep bulunmuyor.</td>
                </tr>
              ) : tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  style={styles.ticketRow}
                  onClick={() => onViewTicket(ticket.id)}
                >
                  <td style={styles.td}>{ticket.id}</td>
                  <td style={styles.td}>{ticket.title}</td>
                  <td style={styles.td}>{ticket.talep_tipi || '—'}</td>
                  <td style={styles.td}>{ticket.kategori}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusChip, background: STATUS_COLORS[ticket.status] || '#64748B' }}>
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                  </td>
                  <td style={styles.td}>{ticket.kullanici}</td>
                  <td style={styles.td}>
                    <span style={{ color: ticket.atanan_sub_admin ? '#185FA5' : '#94A3B8', fontSize: 13, fontWeight: ticket.atanan_sub_admin ? 600 : 400 }}>
                      {ticket.atanan_sub_admin || '—'}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(ticket.created_at).toLocaleString('tr-TR')}</td>
                  <td style={styles.td}>
                    <button
                      style={assignBtnStyle}
                      onClick={(e) => openAssignModal(e, ticket)}
                    >
                      {ticket.atanan_sub_admin ? '✅ Değiştir' : '👤 Ata'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.pagination}>
          <button
            style={{ ...styles.pagerBtn, opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
            onClick={() => page > 1 && setPage(page - 1)}
            disabled={page <= 1}
          >
            Önceki
          </button>
          <div style={styles.pageInfo}>
            {page} / {Math.max(1, Math.ceil(total / pageSize))} ({total} talep)
          </div>
          <button
            style={{ ...styles.pagerBtn, opacity: tickets.length < pageSize ? 0.5 : 1, cursor: tickets.length < pageSize ? 'not-allowed' : 'pointer' }}
            onClick={() => tickets.length === pageSize && setPage(page + 1)}
            disabled={tickets.length < pageSize}
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>

    {/* ── Atama Modalı ── */}
    {assignModal && (
      <div style={modalOverlay} onClick={() => setAssignModal(null)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#0F172A' }}>Yardımcı Admin Ata</h2>
          <p style={{ margin: '0 0 1.25rem', fontSize: 14, color: '#475569' }}>
            Talep #{assignModal.ticketId} için yardımcı admin seçin.
          </p>

          {assignError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', marginBottom: '1rem', fontSize: 13 }}>
              {assignError}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>Yardımcı Admin</div>
            <select
              value={assigningId}
              onChange={e => setAssigningId(e.target.value)}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #CBD5E1', padding: '12px 14px', fontSize: 14, color: '#1F2937', background: '#fff' }}
              disabled={assigning}
            >
              <option value="">— Atama Yok (Kaldır) —</option>
              {subAdmins.map(sa => (
                <option key={sa.id} value={String(sa.id)}>{sa.username}{sa.department ? ` (${sa.department})` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setAssignModal(null)}
              style={{ border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              İptal
            </button>
            <button
              onClick={handleAssign}
              disabled={assigning}
              style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: assigning ? 'not-allowed' : 'pointer', opacity: assigning ? 0.6 : 1 }}
            >
              {assigning ? 'Atanıyor...' : 'Ata'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#F0F4F8', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 1200, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15, 23, 42, 0.08)', padding: '2rem' },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: '1.75rem' },
  title: { fontSize: 28, fontWeight: 700, margin: 0, color: '#0F172A' },
  subtitle: { margin: '8px 0 0', color: '#475569', fontSize: 14 },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: '1.5rem' },
  select: { minWidth: 180, borderRadius: 12, border: '1px solid #CBD5E1', padding: '12px 14px', fontSize: 14, color: '#1F2937', background: '#fff' },
  errorBox: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#991B1B', marginBottom: '1rem' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 980 },
  th: { textAlign: 'left', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '14px 12px', borderBottom: '1px solid #E2E8F0' },
  td: { padding: '14px 12px', borderBottom: '1px solid #E5E7EB', color: '#1F2937', fontSize: 14 },
  ticketRow: { cursor: 'pointer', transition: 'background 0.15s ease' },
  loadingRow: { padding: '20px', textAlign: 'center', color: '#64748B' },
  emptyRow: { padding: '20px', textAlign: 'center', color: '#64748B' },
  statusChip: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', gap: 12, flexWrap: 'wrap' },
  pagerBtn: { border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', minWidth: 110 },
  pageInfo: { color: '#475569', fontSize: 14, fontWeight: 600 }
};

const assignBtnStyle = {
  background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

const modalBox = {
  background: '#fff', borderRadius: 18, padding: '2rem',
  width: '100%', maxWidth: 440,
  boxShadow: '0 25px 60px rgba(15,23,42,0.2)',
};

