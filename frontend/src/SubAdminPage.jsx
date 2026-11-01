import { useState, useEffect } from 'react';
import api from './api';
import SettingsPage from './SettingsPage';

const STATUS_LABELS = {
  open:        'Açık',
  in_progress: 'İşlemde',
  pending:     'Beklemede',
  resolved:    'Çözüldü',
};

const STATUS_COLORS = {
  open:        '#F59E0B',
  in_progress: '#1D9E75',
  pending:     '#0EA5E9',
  resolved:    '#10B981',
};

const MANAGER_STATUS_LABELS = {
  beklemede:  '⏳ Beklemede',
  onaylandi:  '✅ Onaylandı',
  reddedildi: '❌ Reddedildi',
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
  if (field === 'manager_status') return (value === 'beklemede' ? 'Beklemede' : value === 'onaylandi' ? 'Onaylandı' : value === 'reddedildi' ? 'Reddedildi' : value);
  return value;
}

// ─── Ticket Detay (inline) ───────────────────────────────────────────────────
function SubAdminTicketDetail({ ticketId, onBack }) {
  const [ticket,   setTicket]   = useState(null);
  const [comments, setComments] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [selectedStatus,  setSelectedStatus]  = useState('');
  const [statusUpdating,  setStatusUpdating]  = useState(false);
  const [statusMsg,       setStatusMsg]       = useState('');
  const [statusError,     setStatusError]     = useState('');

  const [commentText,    setCommentText]    = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [commentError,   setCommentError]   = useState('');

  useEffect(() => {
    if (!ticketId) return;
    fetchDetail();
  }, [ticketId]);

  const fetchDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/tickets/${ticketId}`);
      setTicket(data.ticket);
      setComments(data.comments || []);
      setHistory(data.history || []);
      setSelectedStatus(data.ticket.status);
    } catch (err) {
      setError('Talep detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === ticket.status) return;
    setStatusUpdating(true);
    setStatusMsg('');
    setStatusError('');
    try {
      const { data } = await api.patch(`/tickets/${ticketId}`, { status: selectedStatus });
      setTicket(data.ticket);
      const { data: fresh } = await api.get(`/tickets/${ticketId}`);
      setHistory(fresh.history || []);
      setStatusMsg('Durum başarıyla güncellendi.');
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Durum güncellenemedi.');
      setSelectedStatus(ticket.status);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentSending(true);
    setCommentError('');
    try {
      const { data } = await api.post(`/tickets/${ticketId}/comments`, { content: commentText.trim() });
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Yorum gönderilemedi.');
    } finally {
      setCommentSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15,23,42,0.08)', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: '1.75rem' }}>
          <button style={ds.backBtn} onClick={onBack}>← Geri</button>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#0F172A' }}>Talep Detayı</h1>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 14 }}>Talebin bilgilerini ve geçmişini buradan yönetebilirsin.</p>
          </div>
        </div>

        {loading && <div style={{ color: '#64748B', padding: '18px 0' }}>Yükleniyor...</div>}
        {error   && <div style={ds.errorBox}>{error}</div>}

        {ticket && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
              <div>
                <div style={ds.label}>Başlık</div>
                <div style={{ fontSize: 20, color: '#1F2937', fontWeight: 600 }}>{ticket.title}</div>
              </div>
              <div>
                <div style={ds.label}>Durum</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, color: '#fff', fontSize: 13, fontWeight: 700, background: STATUS_COLORS[ticket.status] || '#64748B' }}>
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={ds.label}>Açıklama</div>
              <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '1.25rem', color: '#334155', lineHeight: 1.75, border: '1px solid #E2E8F0' }}>{ticket.description}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: '1.5rem' }}>
              {[['Kategori', ticket.kategori], ['Talep Tipi', ticket.talep_tipi || '—'], ['Talep Eden', ticket.kullanici]].map(([k, v]) => (
                <div key={k} style={{ background: '#F8FAFC', borderRadius: 14, padding: '1rem', border: '1px solid #E2E8F0' }}>
                  <div style={ds.label}>{k}</div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
              <div><div style={ds.label}>Oluşturma</div><div>{new Date(ticket.created_at).toLocaleString('tr-TR')}</div></div>
              <div><div style={ds.label}>Manager Onayı</div><div>{MANAGER_STATUS_LABELS[ticket.manager_status] || ticket.manager_status}</div></div>
            </div>

            {/* Durum Güncelle */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 1rem', color: '#1E293B' }}>Durumu Güncelle</h2>
              {statusMsg   && <div style={ds.successBox}>{statusMsg}</div>}
              {statusError && <div style={ds.errorBox}>{statusError}</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); setStatusMsg(''); setStatusError(''); }}
                  style={{ flex: 1, minWidth: 180, maxWidth: 280, borderRadius: 12, border: '1px solid #CBD5E1', padding: '12px 14px', fontSize: 14, color: '#1F2937', background: '#fff' }}
                  disabled={statusUpdating}>
                  {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button style={{ ...ds.btn, opacity: selectedStatus === ticket.status || statusUpdating ? 0.5 : 1, cursor: selectedStatus === ticket.status || statusUpdating ? 'not-allowed' : 'pointer' }}
                  onClick={handleStatusUpdate} disabled={selectedStatus === ticket.status || statusUpdating}>
                  {statusUpdating ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* Yorumlar */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 1rem', color: '#1E293B' }}>Yorumlar ({comments.length})</h2>
              {comments.length === 0
                ? <div style={{ color: '#64748B', padding: '1rem', background: '#F8FAFC', borderRadius: 14 }}>Henüz yorum yok.</div>
                : comments.map((c, i) => (
                  <div key={c.id ?? i} style={{ background: '#F8FAFC', borderRadius: 14, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}><strong>{c.yazan}</strong> · {new Date(c.created_at).toLocaleString('tr-TR')}</div>
                    <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{c.content}</div>
                  </div>
                ))}
              <form onSubmit={handleCommentSubmit} style={{ marginTop: '1rem', display: 'grid', gap: 10 }}>
                <div style={ds.label}>Yeni Yorum</div>
                {commentError && <div style={ds.errorBox}>{commentError}</div>}
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Talep hakkında bir yorum ekleyin..."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  rows={3} disabled={commentSending} />
                <button type="submit" style={{ ...ds.btn, opacity: !commentText.trim() || commentSending ? 0.5 : 1, cursor: !commentText.trim() || commentSending ? 'not-allowed' : 'pointer', width: 'fit-content' }}
                  disabled={!commentText.trim() || commentSending}>
                  {commentSending ? 'Gönderiliyor...' : '💬 Yorum Gönder'}
                </button>
              </form>
            </div>

            {/* Geçmiş */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 1rem', color: '#1E293B' }}>Değişiklik Geçmişi ({history.length})</h2>
              {history.length === 0
                ? <div style={{ color: '#64748B', padding: '1rem', background: '#F8FAFC', borderRadius: 14 }}>Henüz değişiklik kaydı yok.</div>
                : history.map((h, i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 14, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}><strong>{h.degistiren}</strong> · {new Date(h.changed_at).toLocaleString('tr-TR')}</div>
                    <div style={{ fontSize: 14, color: '#334155' }}>
                      <span style={{ fontWeight: 700, color: '#1E293B' }}>{historyFieldLabel(h.field_name)}</span>{' '}
                      <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}>{historyValueLabel(h.field_name, h.old_value)}</span>
                      {' → '}
                      <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}>{historyValueLabel(h.field_name, h.new_value)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub Admin Ana Sayfa ─────────────────────────────────────────────────────
export default function SubAdminPage({ user, onLogout }) {
  const [view,         setView]         = useState('dashboard');
  const [selectedId,   setSelectedId]   = useState(null);
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const [createForm,  setCreateForm]  = useState({ username: '', email: '', password: '', department: '' });
  const [creating,    setCreating]    = useState(false);
  const [createMsg,   setCreateMsg]   = useState('');
  const [createError, setCreateError] = useState('');

  // Dashboard istatistikleri
  const stats = {
    total:       tickets.length,
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending:     tickets.filter(t => t.status === 'pending').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
    comments:    tickets.reduce((s, t) => s + (t.yorum_sayisi || 0), 0),
  };

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/sub-admin/tickets');
      setTickets(data.tickets || []);
    } catch (err) {
      setError('Talepler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg('');
    setCreateError('');
    try {
      await api.post('/admin/create-sub-admin', createForm);
      setCreateMsg('Yardımcı admin başarıyla oluşturuldu.');
      setCreateForm({ username: '', email: '', password: '', department: '' });
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  if (view === 'detail' && selectedId) {
    return <SubAdminTicketDetail ticketId={selectedId} onBack={() => { setView('list'); setSelectedId(null); }} />;
  }

  // ── Sidebar nav items ──
  const navItems = [
    { key: 'dashboard', label: 'Dashboard'   },
    { key: 'list',      label: 'Taleplerim' },
    { key: 'settings',  label: 'Ayarlar'    },
  ];

  // ── Durum renkleri çubuk genişliği ──
  const barWidth = (count) => stats.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : '0%';

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, height: '100vh', boxSizing: 'border-box', background: '#0C447C', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: '2rem', paddingLeft: 4 }}>TTS</div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => (
            <button key={item.key}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                background: view === item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: view === item.key ? '#fff' : 'rgba(255,255,255,0.75)',
              }}
              onClick={() => setView(item.key)}>{item.label}</button>
          ))}
        </nav>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>Giriş yapan</div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{user.username}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Yardımcı Admin</div>
        </div>
        <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left' }}
          onClick={onLogout}>Çıkış Yap</button>
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, background: '#F0F4F8', overflowY: 'auto', padding: '2rem' }}>

        {/* ── DASHBOARD ── */}
        {view === 'dashboard' && (
          <div>
            {/* Hoşgeldin */}
            <div style={{ marginBottom: '1.75rem' }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', margin: 0 }}>Hoş geldin, {user.username}</h1>
            </div>

            {/* İstatistik Kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: '1.75rem' }}>
              {[
                { label: 'Toplam Talep', value: stats.total,       icon: '🎫', color: '#185FA5', bg: '#EFF6FF' },
                { label: 'Açık',          value: stats.open,        icon: '🟡', color: '#B45309', bg: '#FFFBEB' },
                { label: 'İşlemde',       value: stats.in_progress, icon: '🔵', color: '#0369A1', bg: '#F0F9FF' },
                { label: 'Beklemede',     value: stats.pending,     icon: '🟣', color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Çözüldü',       value: stats.resolved,    icon: '✅', color: '#065F46', bg: '#ECFDF5' },
                { label: 'Toplam Yorum',  value: stats.comments,    icon: '💬', color: '#9D174D', bg: '#FDF2F8' },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 12px rgba(15,23,42,0.06)', border: `1px solid ${card.bg}` }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                    {loading ? '—' : card.value}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: 500 }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: '1.75rem' }}>

              {/* Durum Dağılımı */}
              <div style={{ background: '#fff', borderRadius: 18, padding: '1.5rem', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 1.25rem' }}>📊 Durum Dağılımı</h2>
                {[
                  { label: 'Açık',      count: stats.open,        color: '#F59E0B' },
                  { label: 'İşlemde',   count: stats.in_progress, color: '#0EA5E9' },
                  { label: 'Beklemede', count: stats.pending,      color: '#A855F7' },
                  { label: 'Çözüldü',   count: stats.resolved,    color: '#10B981' },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{row.label}</span>
                      <span>{row.count} <span style={{ color: '#94A3B8' }}>/ {stats.total}</span></span>
                    </div>
                    <div style={{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: barWidth(row.count), background: row.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Son Aktivite */}
              <div style={{ background: '#fff', borderRadius: 18, padding: '1.5rem', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 1.25rem' }}>🕐 Son Aktivite</h2>
                {loading ? (
                  <div style={{ color: '#94A3B8', fontSize: 14 }}>Yükleniyor...</div>
                ) : tickets.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '1.5rem 0' }}>Henüz talep yok</div>
                ) : tickets.slice(0, 5).map(t => (
                  <div key={t.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    onClick={() => { setSelectedId(t.id); setView('detail'); }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[t.status] || '#64748B', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{t.kategori} · {new Date(t.created_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[t.status] || '#64748B', flexShrink: 0 }}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                ))}
                {tickets.length > 5 && (
                  <button
                    style={{ width: '100%', marginTop: 10, background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px', fontSize: 13, color: '#185FA5', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                    onClick={() => setView('list')}>
                    Tümünü Gör ({tickets.length})
                  </button>
                )}
              </div>
            </div>

            {/* Hızlı Eylem Kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { icon: '📋', title: 'Taleplerim', desc: `${stats.total} talep atanmış`, action: () => setView('list'), color: '#185FA5', bg: '#EFF6FF' },
                { icon: '🔴', title: 'Açık Talepler', desc: `${stats.open} işlem bekliyor`, action: () => setView('list'), color: '#DC2626', bg: '#FEF2F2' },
                { icon: '✅', title: 'Çözülenler', desc: `${stats.resolved} tamamlandı`, action: () => setView('list'), color: '#059669', bg: '#ECFDF5' },
              ].map(card => (
                <button key={card.title}
                  style={{ background: '#fff', border: `1px solid ${card.bg}`, borderRadius: 16, padding: '1.25rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(15,23,42,0.04)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onClick={card.action}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'; }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: card.color, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{card.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Talep Listesi ── */}
        {view === 'list' && (
          <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15,23,42,0.08)', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0 }}>Taleplerim</h1>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>Yalnızca size atanmış talepler listeleniyor.</p>
              </div>
              <button style={ds.btn} onClick={fetchTickets}>🔄 Yenile</button>
            </div>

            {error && <div style={ds.errorBox}>{error}</div>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {['ID', 'Başlık', 'Kategori', 'Talep Tipi', 'Manager Onayı', 'Durum', 'Oluşturulma', 'Yorum'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '14px 12px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>Yükleniyor...</td></tr>
                  ) : tickets.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>Henüz size atanmış talep yok.</td></tr>
                  ) : tickets.map(t => (
                    <tr key={t.id} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => { setSelectedId(t.id); setView('detail'); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={ds.td}>{t.id}</td>
                      <td style={{ ...ds.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                      <td style={ds.td}>{t.kategori}</td>
                      <td style={ds.td}>{t.talep_tipi || '—'}</td>
                      <td style={ds.td}>{MANAGER_STATUS_LABELS[t.manager_status] || t.manager_status}</td>
                      <td style={ds.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700, background: STATUS_COLORS[t.status] || '#64748B' }}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </td>
                      <td style={ds.td}>{new Date(t.created_at).toLocaleDateString('tr-TR')}</td>
                      <td style={{ ...ds.td, textAlign: 'center' }}>{t.yorum_sayisi ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Sub Admin Oluştur ── */}
        {view === 'create' && (
          <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15,23,42,0.08)', padding: '2rem', maxWidth: 560 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>Yardımcı Admin Ekle</h1>
            <p style={{ margin: '0 0 1.5rem', color: '#475569', fontSize: 14 }}>Yeni bir yardımcı admin hesabı oluşturun.</p>

            {createMsg   && <div style={ds.successBox}>{createMsg}</div>}
            {createError && <div style={ds.errorBox}>{createError}</div>}

            <form onSubmit={handleCreateSubAdmin} style={{ display: 'grid', gap: 16 }}>
              {[
                { label: 'Kullanıcı Adı', key: 'username',   type: 'text',     placeholder: 'ornek.kullanici', required: true },
                { label: 'E-posta',        key: 'email',      type: 'email',    placeholder: 'ornek@sirket.com', required: true },
                { label: 'Parola',         key: 'password',   type: 'password', placeholder: 'En az 6 karakter', required: true },
                { label: 'Departman',      key: 'department', type: 'text',     placeholder: 'Opsiyonel',        required: false },
              ].map(f => (
                <div key={f.key}>
                  <div style={ds.label}>{f.label}</div>
                  <input type={f.type} placeholder={f.placeholder} value={createForm[f.key]}
                    onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    required={f.required} />
                </div>
              ))}
              <button type="submit" style={{ ...ds.btn, opacity: creating ? 0.6 : 1, cursor: creating ? 'not-allowed' : 'pointer', width: 'fit-content' }} disabled={creating}>
                {creating ? 'Oluşturuluyor...' : '➕ Yardımcı Admin Oluştur'}
              </button>
            </form>
          </div>
        )}

        {/* ── Ayarlar ── */}
        {view === 'settings' && <SettingsPage user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
}

// ─── Paylaşılan Stiller ──────────────────────────────────────────────────────
const ds = {
  backBtn:    { border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  label:      { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 },
  btn:        { background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  td:         { padding: '14px 12px', borderBottom: '1px solid #E5E7EB', color: '#1F2937', fontSize: 14 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#991B1B', marginBottom: '1rem' },
  successBox: { background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px', color: '#065F46', marginBottom: '1rem' },
};
