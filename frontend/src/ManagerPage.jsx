import { useState, useEffect, useCallback } from 'react';
import api from './api';
import SettingsPage from './SettingsPage';

/* ─────────────────────────────────────────────────────────────────────────────
   Yardımcı: kategori rengi
───────────────────────────────────────────────────────────────────────────── */
const CAT_COLORS = {
  'BİLGİSAYAR':        '#3B82F6',
  'NETWORK (LAN-WAN)': '#8B5CF6',
  'SAP':               '#F59E0B',
  'PDKS':              '#10B981',
  'YAZICI':            '#EF4444',
  'UPS':               '#F97316',
};
const catColor = (k) => CAT_COLORS[k] || '#6B7280';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtShort(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Alt bileşen: TALEP OLUŞTUR (AI destekli)
───────────────────────────────────────────────────────────────────────────── */
function CreateTicketPanel({ onCreated }) {
  const [form, setForm]           = useState({ title: '', description: '' });
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');
  const [autoType, setAutoType]   = useState('');
  const [autoCat, setAutoCat]     = useState('');
  const [predicting, setPred]     = useState(false);
  const [predErr, setPredErr]     = useState(false);

  /* Açıklama değiştiğinde AI tahmini */
  useEffect(() => {
    if (!form.description.trim()) {
      setAutoType(''); setAutoCat(''); setPredErr(false); return;
    }
    const t = setTimeout(async () => {
      setPred(true); setPredErr(false);
      try {
        const apiRoot = process.env.REACT_APP_API_ROOT || 'http://localhost:5000';
        const res = await fetch(`${apiRoot}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metin: form.description }),
        });
        const data = await res.json();
        setAutoType(data.talep_tipi || '');
        setAutoCat(data.kategori || '');
      } catch {
        setPredErr(true); setAutoType(''); setAutoCat('');
      } finally { setPred(false); }
    }, 1000);
    return () => clearTimeout(t);
  }, [form.description]);

  const handleChange = (e) => {
    setError(''); setMessage('');
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!form.title.trim() || !form.description.trim()) {
      setError('Lütfen başlık ve açıklama alanlarını doldurun.'); return;
    }
    if (!autoCat) {
      setError('Açıklama analiz edilemedi. Lütfen biraz daha detaylı yazın.'); return;
    }
    try {
      const { data } = await api.post('/tickets', {
        title:       form.title,
        description: form.description,
        category:    autoCat,
      });
      const pending = data.ticket?.manager_status === 'beklemede';
      setMessage(
        pending
          ? 'Talebiniz gönderildi ve departman yöneticinizin onayı bekleniyor.'
          : 'Talebiniz başarıyla gönderildi ve işleme alındı.'
      );
      setForm({ title: '', description: '' });
      setAutoType(''); setAutoCat('');
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Talep kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div style={s.panelWrap}>
      <div style={s.panelHeader}>
        <h2 style={s.panelTitle}>Talep Oluştur</h2>
        <p style={s.panelSub}>Yeni bir destek talebi oluşturun, sistem kategorisini otomatik tespit eder.</p>
      </div>

      {error   && <div style={s.errorBox}>{error}</div>}
      {message && <div style={s.successBox}>{message}</div>}

      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>
          Talep Başlığı
          <input
            style={s.input}
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Talebinizin konusunu yazın"
          />
        </label>

        <label style={s.label}>
          Talep Açıklaması
          <textarea
            style={{ ...s.input, minHeight: 140, resize: 'vertical' }}
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Talebinizle ilgili detayları buraya yazın... (AI otomatik kategori tespit eder)"
          />
        </label>

        <div style={s.autoGrid}>
          <label style={s.label}>
            Talep Tipi
            <div style={{ ...s.autoField, color: autoType ? '#0F172A' : '#94A3B8', borderColor: predErr ? '#FECACA' : '#CBD5E1' }}>
              {predicting ? '⏳ Analiz ediliyor...' : predErr ? '⚠️ Bağlantı hatası' : autoType || '—'}
            </div>
          </label>
          <label style={s.label}>
            Kategori
            <div style={{ ...s.autoField, color: autoCat ? '#0F172A' : '#94A3B8', borderColor: predErr ? '#FECACA' : '#CBD5E1' }}>
              {predicting ? '⏳ Analiz ediliyor...' : predErr ? '⚠️ Bağlantı hatası' : autoCat || '—'}
            </div>
          </label>
        </div>

        <button
          type="submit"
          style={{ ...s.submitBtn, opacity: predicting || !autoCat ? 0.55 : 1, cursor: predicting || !autoCat ? 'not-allowed' : 'pointer' }}
          disabled={predicting || !autoCat}
        >
          {predicting ? 'Analiz ediliyor...' : 'Talep Gönder'}
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Alt bileşen: ONAY BEKLEYENLERi
───────────────────────────────────────────────────────────────────────────── */
function PendingApprovalPanel() {
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actionId, setActionId]   = useState(null);
  const [noteMap, setNoteMap]     = useState({});
  const [rejectOpen, setRejectOpen] = useState(null);
  const [feedback, setFeedback]   = useState({ type: '', msg: '' });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tickets/manager');
      setTickets(data.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleAction = async (ticketId, action) => {
    setActionId(ticketId);
    setFeedback({ type: '', msg: '' });
    try {
      await api.put(`/tickets/${ticketId}/manager-action`, {
        action,
        note: noteMap[ticketId] || '',
      });
      setFeedback({
        type: 'success',
        msg: action === 'onaylandi' ? '✓ Talep onaylandı.' : '✕ Talep reddedildi.',
      });
      setRejectOpen(null);
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    } catch (err) {
      setFeedback({ type: 'error', msg: err.response?.data?.message || 'İşlem gerçekleştirilemedi.' });
    } finally { setActionId(null); }
  };

  return (
    <div style={s.panelWrap}>
      <div style={{ ...s.panelHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={s.panelTitle}>Onay Bekleyen Talepler</h2>
          <p style={s.panelSub}>Departmanınızdan gelen onay bekleyen talepler</p>
        </div>
        <button style={s.refreshBtn} onClick={fetchTickets}>↻ Yenile</button>
      </div>

      {feedback.msg && (
        <div style={feedback.type === 'success' ? s.successBox : s.errorBox}>{feedback.msg}</div>
      )}

      {loading && (
        <div style={s.stateBox}>
          <div style={s.spinner} />
          <span>Talepler yükleniyor...</span>
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>✓</div>
          <div style={s.emptyTitle}>Bekleyen talep yok</div>
          <div style={s.emptyText}>Departmanınızdan onay bekleyen talep bulunmuyor.</div>
        </div>
      )}

      {!loading && tickets.map(ticket => {
        const isProcessing = actionId === ticket.id;
        const cc           = catColor(ticket.kategori);
        const isRejectOpen = rejectOpen === ticket.id;

        return (
          <div key={ticket.id} style={s.ticketCard}>
            <div style={{ ...s.categoryStripe, background: cc }} />
            <div style={s.ticketBody}>
              <div style={s.ticketTop}>
                <div style={s.ticketTitleWrap}>
                  <span style={s.ticketId}>#{ticket.id}</span>
                  <h3 style={s.ticketTitle}>{ticket.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ticket.talep_tipi && (
                    <span style={{
                      ...s.typeBadge,
                      background:  ticket.talep_tipi === 'DONANIM' ? '#EFF6FF' : '#F5F3FF',
                      color:       ticket.talep_tipi === 'DONANIM' ? '#1E40AF' : '#6D28D9',
                      borderColor: ticket.talep_tipi === 'DONANIM' ? '#BFDBFE' : '#DDD6FE',
                    }}>{ticket.talep_tipi}</span>
                  )}
                  <span style={{ ...s.typeBadge, background: '#F8FAFC', color: cc, borderColor: '#E2E8F0' }}>
                    {ticket.kategori}
                  </span>
                </div>
              </div>

              <div style={s.ticketMeta}>
                <span>👤 {ticket.kullanici}</span>
                {ticket.kullanici_departman && <span>🏢 {ticket.kullanici_departman}</span>}
                <span>📅 {fmtDate(ticket.created_at)}</span>
              </div>

              {ticket.description && (
                <p style={s.ticketDesc}>{ticket.description}</p>
              )}

              {isRejectOpen && (
                <div style={s.noteArea}>
                  <label style={s.noteLabel}>Red Nedeni (isteğe bağlı)</label>
                  <textarea
                    style={s.noteInput}
                    placeholder="Bu talebi neden reddediyorsunuz?"
                    value={noteMap[ticket.id] || ''}
                    onChange={e => setNoteMap(p => ({ ...p, [ticket.id]: e.target.value }))}
                    rows={3}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      style={{ ...s.actionBtn, ...s.rejectConfirmBtn }}
                      onClick={() => handleAction(ticket.id, 'reddedildi')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'İşleniyor...' : 'Reddet'}
                    </button>
                    <button
                      style={{ ...s.actionBtn, ...s.cancelBtn }}
                      onClick={() => setRejectOpen(null)}
                      disabled={isProcessing}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {!isRejectOpen && (
                <div style={s.actions}>
                  <button
                    style={{ ...s.actionBtn, ...s.approveBtn, opacity: isProcessing ? 0.6 : 1 }}
                    onClick={() => handleAction(ticket.id, 'onaylandi')}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '...' : '✓ Onayla'}
                  </button>
                  <button
                    style={{ ...s.actionBtn, ...s.rejectBtn, opacity: isProcessing ? 0.6 : 1 }}
                    onClick={() => setRejectOpen(ticket.id)}
                    disabled={isProcessing}
                  >
                    ✕ Reddet
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Alt bileşen: TALEPLERİM (yöneticinin kendi açtıkları)
───────────────────────────────────────────────────────────────────────────── */
function MyTicketsPanel() {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tickets/my');
      setTickets(data.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function msLabel(ms) {
    if (ms === 'onaylandi')  return { label: 'Onaylandı',               color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' };
    if (ms === 'reddedildi') return { label: 'Reddedildi',              color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' };
    return                          { label: 'Yönetici Onayı Bekleniyor', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' };
  }
  function stLabel(st) {
    const m = {
      open:        { label: 'Açık',      color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
      in_progress: { label: 'İşlemde',   color: '#6B21A8', bg: '#FAF5FF', border: '#E9D5FF' },
      pending:     { label: 'Beklemede', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
      resolved:    { label: 'Çözüldü',   color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
    };
    return m[st] || { label: st, color: '#475569', bg: '#F8FAFC', border: '#CBD5E1' };
  }

  return (
    <div style={s.panelWrap}>
      <div style={{ ...s.panelHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={s.panelTitle}>Taleplerim</h2>
          <p style={s.panelSub}>Sizin oluşturduğunuz talepler</p>
        </div>
        <button style={s.refreshBtn} onClick={fetch_}>↻ Yenile</button>
      </div>

      {loading && (
        <div style={s.stateBox}><div style={s.spinner} /><span>Yükleniyor...</span></div>
      )}

      {!loading && tickets.length === 0 && (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>📋</div>
          <div style={s.emptyTitle}>Henüz talep oluşturmadınız</div>
          <div style={s.emptyText}>Sol menüden "Talep Oluştur" sekmesine geçerek yeni talep açabilirsiniz.</div>
        </div>
      )}

      {!loading && tickets.map(t => {
        const ms = msLabel(t.manager_status);
        const st = stLabel(t.status);
        return (
          <div key={t.id} style={s.myTicketCard}>
            <div style={s.myTicketHeader}>
              <div>
                <div style={s.myTicketTitle}>#{t.id} — {t.title}</div>
                <div style={s.myTicketMeta}>
                  {t.kategori} · {t.talep_tipi || '—'} · {fmtShort(t.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {t.manager_status !== 'onaylandi' && (
                  <span style={{ ...s.badge, color: ms.color, background: ms.bg, borderColor: ms.border }}>{ms.label}</span>
                )}
                <span style={{ ...s.badge, color: st.color, background: st.bg, borderColor: st.border }}>{st.label}</span>
              </div>
            </div>
            {t.manager_status === 'reddedildi' && t.manager_note && (
              <div style={s.noteBox}><strong>Yönetici Notu:</strong> {t.manager_note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Alt bileşen: DASHBOARD (istatistikler)
───────────────────────────────────────────────────────────────────────────── */
function DashboardPanel({ user }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Yöneticiye ait tüm talepleri çek, istatistik hesapla
        const { data } = await api.get('/tickets/manager/stats');
        setStats(data);
      } catch { setStats(null); }
      finally { setLoading(false); }
    })();
  }, []);

  const StatCard = ({ icon, label, value, color, bg }) => (
    <div style={{ ...s.statCard, background: bg, borderColor: color + '33' }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{loading ? '—' : (value ?? 0)}</div>
      <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={s.panelWrap}>
      <div style={s.panelHeader}>
        <h2 style={s.panelTitle}>Hoş Geldiniz, {user.username}</h2>
      </div>

      <div style={s.statsGrid}>
        <StatCard icon="⏳" label="Onay Bekleyen"  value={stats?.bekleyen}    color="#D97706" bg="#FFFBEB" />
        <StatCard icon="✅" label="Onaylanan"      value={stats?.onaylanan}   color="#059669" bg="#ECFDF5" />
        <StatCard icon="❌" label="Reddedilen"     value={stats?.reddedilen}  color="#DC2626" bg="#FEF2F2" />
        <StatCard icon="📋" label="Kendi Talebim"  value={stats?.kendi_talep} color="#6D28D9" bg="#F5F3FF" />
      </div>


    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANA BİLEŞEN: ManagerPage
───────────────────────────────────────────────────────────────────────────── */
export default function ManagerPage({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');

  const navItems = [
    { key: 'dashboard',  label: 'Dashboard'          },
    { key: 'create',     label: 'Talep Oluştur'      },
    { key: 'pending',    label: 'Onay Bekleyenler'   },
    { key: 'mytickets',  label: 'Taleplerim'         },
    { key: 'settings',   label: 'Ayarlar'            },
  ];

  return (
    <div style={s.page}>
      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarLogo}>TTS</div>

        <div style={s.sidebarUserInfo}>
          <div style={s.avatar}>{user.username?.[0]?.toUpperCase() || 'Y'}</div>
          <div style={s.sidebarUsername}>{user.username}</div>
          <div style={s.sidebarRole}>Departman Yöneticisi</div>
          {user.department && <div style={s.sidebarDept}>{user.department}</div>}
        </div>

        <nav style={s.nav}>
          {navItems.map(item => (
            <button
              key={item.key}
              style={{
                ...s.navItem,
                ...(page === item.key ? s.navItemActive : {}),
              }}
              onClick={() => setPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button style={s.sidebarLogout} onClick={onLogout}>
          Çıkış Yap
        </button>
      </div>

      {/* ── İçerik ── */}
      <div style={s.main}>
        {page === 'dashboard' && <DashboardPanel user={user} />}
        {page === 'create'    && <CreateTicketPanel onCreated={() => setPage('mytickets')} />}
        {page === 'pending'   && <PendingApprovalPanel />}
        {page === 'mytickets' && <MyTicketsPanel />}
        {page === 'settings'  && <SettingsPage user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STILLER
───────────────────────────────────────────────────────────────────────────── */
const s = {
  page:    { display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', background: '#F0F4F8' },

  /* Sidebar */
  sidebar: {
    width: 240, height: '100vh', boxSizing: 'border-box', flexShrink: 0,
    background: 'linear-gradient(160deg, #0C447C 0%, #0a3562 100%)',
    display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem',
    boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
  },
  sidebarLogo:     { color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: 2, marginBottom: '1.5rem', paddingLeft: 4 },
  sidebarUserInfo: { paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 18, marginBottom: 8,
  },
  sidebarUsername: { color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 2 },
  sidebarRole:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 },
  sidebarDept: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
  },
  nav:           { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', borderRadius: 10, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
    textAlign: 'left', transition: 'all 0.15s',
  },
  navItemActive: { background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 },
  navIcon:       { fontSize: 16, width: 20, textAlign: 'center' },
  sidebarLogout: {
    marginTop: '1rem',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: '10px 14px',
    cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left',
    display: 'flex', alignItems: 'center', gap: 8,
  },

  /* Ana alan */
  main: { flex: 1, overflowY: 'auto' },

  /* Panel genel */
  panelWrap:   { padding: '2rem', maxWidth: 900 },
  panelHeader: { marginBottom: '1.5rem' },
  panelTitle:  { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' },
  panelSub:    { fontSize: 13, color: '#64748B', margin: 0 },

  /* Dashboard istatistikler */
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem', marginBottom: '2rem',
  },
  statCard: {
    background: '#fff', borderRadius: 16, padding: '1.5rem',
    textAlign: 'center', border: '1.5px solid',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },

  /* Talep oluştur formu */
  form:      { display: 'grid', gap: '1rem' },
  label:     { display: 'grid', gap: 6, fontSize: 13, color: '#475569', fontWeight: 600 },
  input:     {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid #CBD5E1', background: '#F8FAFC',
    color: '#0F172A', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  },
  autoGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  autoField: {
    padding: '14px 16px', borderRadius: 12, border: '1px solid #CBD5E1',
    background: '#F1F5F9', fontSize: 14, fontWeight: 600,
    minHeight: 50, display: 'flex', alignItems: 'center',
  },
  submitBtn:  {
    marginTop: '0.5rem', background: 'linear-gradient(135deg, #185FA5 0%, #0C447C 100%)',
    color: '#fff', border: 'none', borderRadius: 12, padding: '14px 18px',
    fontSize: 15, fontWeight: 700, fontFamily: 'inherit', letterSpacing: 0.3,
  },

  /* Durum/feedback kutular */
  successBox: { background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px', color: '#065F46', marginBottom: '1rem', fontWeight: 600 },
  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#991B1B', marginBottom: '1rem', fontWeight: 600 },
  refreshBtn: { padding: '9px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569', fontFamily: 'inherit' },

  /* State box */
  stateBox: { display: 'flex', alignItems: 'center', gap: 12, padding: '2rem', color: '#64748B' },
  spinner:  { width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#185FA5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  /* Boş durum */
  emptyBox:  { textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' },
  emptyIcon: { fontSize: 48, marginBottom: '1rem' },
  emptyTitle:{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748B' },

  /* Talep kartı (onay bekleyenler) */
  ticketCard:      { display: 'flex', background: '#fff', borderRadius: 14, marginBottom: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' },
  categoryStripe:  { width: 5, flexShrink: 0 },
  ticketBody:      { flex: 1, padding: '1.25rem 1.5rem' },
  ticketTop:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '0.6rem', flexWrap: 'wrap' },
  ticketTitleWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  ticketId:        { fontSize: 12, color: '#94A3B8', fontWeight: 600 },
  ticketTitle:     { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 },
  typeBadge:       { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid' },
  ticketMeta:      { display: 'flex', gap: 16, fontSize: 12, color: '#94A3B8', marginBottom: '0.75rem', flexWrap: 'wrap' },
  ticketDesc:      { fontSize: 13, color: '#475569', lineHeight: 1.6, background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', margin: '0.5rem 0 1rem' },
  noteArea:        { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem' },
  noteLabel:       { display: 'block', fontSize: 12, fontWeight: 600, color: '#991B1B', marginBottom: 6 },
  noteInput:       { width: '100%', borderRadius: 8, border: '1px solid #FECACA', padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  actions:         { display: 'flex', gap: 10 },
  actionBtn:       { padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' },
  approveBtn:      { background: '#10B981', color: '#fff' },
  rejectBtn:       { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
  rejectConfirmBtn:{ background: '#EF4444', color: '#fff' },
  cancelBtn:       { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' },

  /* Taleplerim kartı */
  myTicketCard:   { border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '0.75rem', background: '#FAFAFA' },
  myTicketHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  myTicketTitle:  { fontWeight: 700, color: '#0F172A', fontSize: 15, marginBottom: 4 },
  myTicketMeta:   { fontSize: 12, color: '#94A3B8' },
  badge:          { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid', whiteSpace: 'nowrap' },
  noteBox:        { marginTop: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991B1B' },
};
