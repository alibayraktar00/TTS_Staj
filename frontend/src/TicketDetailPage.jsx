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

const MANAGER_STATUS_LABELS = {
  beklemede:  'Beklemede',
  onaylandi:  'Onaylandı',
  reddedildi: 'Reddedildi',
};

const HISTORY_FIELD_LABELS = {
  status:         'Durum',
  manager_status: 'Yönetici Onayı',
};

function historyFieldLabel(field) {
  return HISTORY_FIELD_LABELS[field] || field;
}

function historyValueLabel(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status') return STATUS_LABELS[value] || value;
  if (field === 'manager_status') return MANAGER_STATUS_LABELS[value] || value;
  return value;
}

export default function TicketDetailPage({ ticketId, onBack }) {
  const [ticket, setTicket]       = useState(null);
  const [comments, setComments]   = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Durum güncelleme state'leri
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMsg, setStatusMsg]           = useState('');
  const [statusError, setStatusError]       = useState('');

  // Yorum ekleme state'leri
  const [commentText, setCommentText]       = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [commentError, setCommentError]     = useState('');

  useEffect(() => {
    if (!ticketId) return;
    fetchTicket();
  }, [ticketId]);

  const fetchTicket = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get(`/tickets/${ticketId}`);
      setTicket(data.ticket);
      setComments(data.comments || []);
      setHistory(data.history || []);
      setSelectedStatus(data.ticket.status);
    } catch (err) {
      console.error(err);
      setError('Talep detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Durum Güncelleme ────────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === ticket.status) return;

    setStatusUpdating(true);
    setStatusMsg('');
    setStatusError('');

    try {
      const { data } = await api.patch(`/tickets/${ticketId}`, {
        status: selectedStatus,
      });

      setTicket(data.ticket);

      const { data: fresh } = await api.get(`/tickets/${ticketId}`);
      setHistory(fresh.history || []);

      setStatusMsg('Durum başarıyla güncellendi.');
    } catch (err) {
      console.error(err);
      setStatusError(err.response?.data?.message || 'Durum güncellenemedi.');
      
      setSelectedStatus(ticket.status);
    } finally {
      setStatusUpdating(false);
    }
  };

  // ─── Yorum Gönderme ──────────────────────────────────────────────────────────
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommentSending(true);
    setCommentError('');

    try {
      const { data } = await api.post(`/tickets/${ticketId}/comments`, {
        content: commentText.trim(),
      });

      // Yeni yorumu listeye optimistik olarak ekle
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    } catch (err) {
      console.error(err);
      setCommentError(err.response?.data?.message || 'Yorum gönderilemedi.');
    } finally {
      setCommentSending(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <button style={styles.backBtn} onClick={onBack}>← Geri</button>
          <div>
            <h1 style={styles.title}>Talep Detayı</h1>
            <p style={styles.subtitle}>Talebin kapsamlı bilgilerini ve kaydını buradan yönetebilirsin.</p>
          </div>
        </div>

        {loading && <div style={styles.loading}>Yükleniyor...</div>}
        {error   && <div style={styles.errorBox}>{error}</div>}

        {ticket && (
          <>
            {/* ── Başlık & Durum ── */}
            <div style={styles.headerGrid}>
              <div>
                <div style={styles.label}>Başlık</div>
                <div style={styles.value}>{ticket.title}</div>
              </div>
              <div>
                <div style={styles.label}>Durum</div>
                <div style={{ ...styles.statusBadge, background: STATUS_COLORS[ticket.status] || '#64748B' }}>
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </div>
              </div>
            </div>

            {/* ── Açıklama ── */}
            <div style={styles.fieldGroup}>
              <div style={styles.label}>Açıklama</div>
              <div style={styles.description}>{ticket.description}</div>
            </div>

            {/* ── Meta Bilgiler ── */}
            <div style={styles.rowGrid}>
              <div style={styles.infoBox}>
                <div style={styles.infoTitle}>Kategori</div>
                <div>{ticket.kategori}</div>
              </div>
              <div style={styles.infoBox}>
                <div style={styles.infoTitle}>Talep Tipi</div>
                <div>{ticket.talep_tipi || '—'}</div>
              </div>
              <div style={styles.infoBox}>
                <div style={styles.infoTitle}>Talep Eden</div>
                <div>{ticket.kullanici}</div>
              </div>
            </div>

            <div style={styles.metaGrid}>
              <div>
                <div style={styles.metaLabel}>Oluşturma</div>
                <div>{new Date(ticket.created_at).toLocaleString('tr-TR')}</div>
              </div>
              <div>
                <div style={styles.metaLabel}>Son Güncelleme</div>
                <div>{new Date(ticket.updated_at).toLocaleString('tr-TR')}</div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                DURUM GÜNCELLEME PANELİ
            ──────────────────────────────────────────────────────────────── */}
            <div style={styles.actionPanel}>
              <h2 style={styles.sectionTitle}>Durumu Güncelle</h2>

              {statusMsg   && <div style={styles.successBox}>{statusMsg}</div>}
              {statusError && <div style={styles.errorBox}>{statusError}</div>}

              <div style={styles.statusRow}>
                <select
                  value={selectedStatus}
                  onChange={e => { setSelectedStatus(e.target.value); setStatusMsg(''); setStatusError(''); }}
                  style={styles.select}
                  disabled={statusUpdating}
                >
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>

                <button
                  style={{
                    ...styles.updateBtn,
                    opacity: selectedStatus === ticket.status || statusUpdating ? 0.5 : 1,
                    cursor: selectedStatus === ticket.status || statusUpdating ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleStatusUpdate}
                  disabled={selectedStatus === ticket.status || statusUpdating}
                >
                  {statusUpdating ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                YORUMLAR
            ──────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Yorumlar ({comments.length})</h2>

              {/* Yorum Listesi */}
              {comments.length === 0 ? (
                <div style={styles.emptyText}>Henüz yorum yok.</div>
              ) : (
                comments.map((comment, index) => (
                  <div key={comment.id ?? index} style={styles.commentBox}>
                    <div style={styles.commentMeta}>
                      <strong>{comment.yazan}</strong>
                      &nbsp;·&nbsp;
                      {new Date(comment.created_at).toLocaleString('tr-TR')}
                    </div>
                    <div style={styles.commentContent}>{comment.content}</div>
                  </div>
                ))
              )}

              {/* Yorum Gönderme Formu */}
              <form onSubmit={handleCommentSubmit} style={styles.commentForm}>
                <div style={styles.label}>Yeni Yorum</div>
                {commentError && <div style={styles.errorBox}>{commentError}</div>}
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Talep hakkında bir yorum ekleyin..."
                  style={styles.textarea}
                  rows={3}
                  disabled={commentSending}
                />
                <button
                  type="submit"
                  style={{
                    ...styles.commentBtn,
                    opacity: !commentText.trim() || commentSending ? 0.5 : 1,
                    cursor: !commentText.trim() || commentSending ? 'not-allowed' : 'pointer',
                  }}
                  disabled={!commentText.trim() || commentSending}
                >
                  {commentSending ? 'Gönderiliyor...' : '💬 Yorum Gönder'}
                </button>
              </form>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                DEĞİŞİKLİK GEÇMİŞİ
            ──────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Değişiklik Geçmişi ({history.length})</h2>
              {history.length === 0 ? (
                <div style={styles.emptyText}>Henüz değişiklik kaydı yok.</div>
              ) : (
                history.map((entry, index) => (
                  <div key={index} style={styles.historyRow}>
                    <div style={styles.historyMeta}>
                      <strong>{entry.degistiren}</strong>
                      &nbsp;·&nbsp;
                      {new Date(entry.changed_at).toLocaleString('tr-TR')}
                    </div>
                    <div style={styles.historyChange}>
                      <span style={styles.historyField}>{historyFieldLabel(entry.field_name)}</span>
                      &nbsp;
                      <span style={styles.historyOld}>{historyValueLabel(entry.field_name, entry.old_value)}</span>
                      &nbsp;→&nbsp;
                      <span style={styles.historyNew}>{historyValueLabel(entry.field_name, entry.new_value)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page:        { minHeight: '100vh', background: '#F0F4F8', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' },
  card:        { maxWidth: 980, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15, 23, 42, 0.08)', padding: '2rem' },
  topRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: '1.75rem' },
  backBtn:     { border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  title:       { fontSize: 28, fontWeight: 700, margin: 0, color: '#0F172A' },
  subtitle:    { margin: '8px 0 0', color: '#475569', fontSize: 14 },
  loading:     { color: '#64748B', padding: '18px 0' },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#991B1B', marginBottom: '1rem' },
  successBox:  { background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px', color: '#065F46', marginBottom: '1rem' },
  headerGrid:  { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: '1.5rem' },
  label:       { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 },
  value:       { fontSize: 20, color: '#1F2937', fontWeight: 600 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, color: '#fff', fontSize: 13, fontWeight: 700 },
  fieldGroup:  { marginBottom: '1.5rem' },
  description: { background: '#F8FAFC', borderRadius: 14, padding: '1.25rem', color: '#334155', lineHeight: 1.75, border: '1px solid #E2E8F0' },
  rowGrid:     { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: '1.5rem' },
  infoBox:     { background: '#F8FAFC', borderRadius: 14, padding: '1rem', border: '1px solid #E2E8F0' },
  infoTitle:   { fontSize: 12, color: '#64748B', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 },
  metaGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.5rem' },
  metaLabel:   { fontSize: 12, color: '#64748B', marginBottom: 6 },

  // Durum güncelleme
  actionPanel: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' },
  statusRow:   { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  select:      { flex: 1, minWidth: 180, maxWidth: 280, borderRadius: 12, border: '1px solid #CBD5E1', padding: '12px 14px', fontSize: 14, color: '#1F2937', background: '#fff', cursor: 'pointer' },
  updateBtn:   { background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700 },

  // Yorumlar
  section:        { marginBottom: '2rem' },
  sectionTitle:   { fontSize: 16, fontWeight: 700, margin: '0 0 1rem', color: '#1E293B' },
  commentBox:     { background: '#F8FAFC', borderRadius: 14, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #E2E8F0' },
  commentMeta:    { fontSize: 12, color: '#64748B', marginBottom: 8 },
  commentContent: { fontSize: 14, color: '#334155', lineHeight: 1.6 },
  commentForm:    { marginTop: '1rem', display: 'grid', gap: 10 },
  textarea:       { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  commentBtn:     { background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700, width: 'fit-content' },
  emptyText:      { color: '#64748B', padding: '1rem', background: '#F8FAFC', borderRadius: 14 },

  // Geçmiş
  historyRow:    { background: '#F8FAFC', borderRadius: 14, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #E2E8F0' },
  historyMeta:   { fontSize: 12, color: '#64748B', marginBottom: 8 },
  historyChange: { fontSize: 14, color: '#334155' },
  historyField:  { fontWeight: 700, color: '#1E293B' },
  historyOld:    { background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 13 },
  historyNew:    { background: '#DCFCE7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 13 },
};
