import { useState, useEffect } from 'react';
import api from './api';
import SettingsPage from './SettingsPage';

export default function TalepPage({ user, onBack, onLogout }) {
  const [form, setForm]       = useState({ title: '', description: '' });
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [view, setView]       = useState('create'); // 'create' | 'list' | 'settings'

  const [autoType, setAutoType]         = useState('');
  const [autoCategory, setAutoCategory] = useState('');
  const [predicting, setPredicting]     = useState(false);
  const [predError, setPredError]       = useState(false);

  const [myTickets, setMyTickets]       = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // ─── Otomatik kategori tahmini ────────────────────────────────────────────
  useEffect(() => {
    if (!form.description.trim()) {
      setAutoType('');
      setAutoCategory('');
      setPredError(false);
      return;
    }

    const timer = setTimeout(async () => {
      setPredicting(true);
      setPredError(false);
      try {
        const apiRoot = process.env.REACT_APP_API_ROOT || 'http://localhost:5000';
        const response = await fetch(`${apiRoot}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metin: form.description }),
        });
        const data = await response.json();
        setAutoType(data.talep_tipi || '');
        setAutoCategory(data.kategori || '');
      } catch {
        setPredError(true);
        setAutoType('');
        setAutoCategory('');
      } finally {
        setPredicting(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.description]);

  // ─── Taleplerim yükle ────────────────────────────────────────────────────
  const fetchMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data } = await api.get('/tickets/my');
      setMyTickets(data.tickets || []);
    } catch {
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (view === 'list') fetchMyTickets();
  }, [view]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError('');
    setMessage('');
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.title.trim() || !form.description.trim()) {
      setError('Lütfen başlık ve açıklama alanlarını doldurun.');
      return;
    }
    if (!autoCategory) {
      setError('Açıklama analiz edilemedi. Lütfen açıklamayı biraz daha detaylı yazın.');
      return;
    }

    try {
      const { data } = await api.post('/tickets', {
        title:       form.title,
        description: form.description,
        category:    autoCategory,
      });

      const ticket = data.ticket;
      const managerPending = ticket?.manager_status === 'beklemede';

      setMessage(
        managerPending
          ? 'Talebiniz gönderildi ve departman yöneticinizin onayı bekleniyor.'
          : 'Talebiniz başarıyla gönderildi ve işleme alındı.'
      );
      setForm({ title: '', description: '' });
      setAutoType('');
      setAutoCategory('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Talep kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  // ─── Durum badge yardımcıları ─────────────────────────────────────────────
  function managerStatusLabel(ms) {
    if (ms === 'onaylandi')  return { label: 'Onaylandı',          color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' };
    if (ms === 'reddedildi') return { label: 'Reddedildi',         color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' };
    return                          { label: 'Yönetici Onayı Bekleniyor', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' };
  }

  function ticketStatusLabel(status) {
    const map = {
      open:        { label: 'Açık',       color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
      in_progress: { label: 'İşlemde',    color: '#6B21A8', bg: '#FAF5FF', border: '#E9D5FF' },
      pending:     { label: 'Beklemede',  color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
      resolved:    { label: 'Çözüldü',    color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
    };
    return map[status] || { label: status, color: '#475569', bg: '#F8FAFC', border: '#CBD5E1' };
  }

  // ─── TALEP OLUŞTUR paneli ───────────────────────────────────────────────
  const createPanel = (
    <>
      <h1 style={styles.title}>Talep Oluştur</h1>

      {error   && <div style={styles.errorBox}>{error}</div>}
      {message && <div style={styles.successBox}>{message}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Talep Başlığı
          <input
            style={styles.input}
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Talebinizin konusunu yazın"
          />
        </label>

        <label style={styles.label}>
          Talep Açıklaması
          <textarea
            style={{ ...styles.input, minHeight: 140, resize: 'vertical' }}
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Talebinizle ilgili detayları buraya yazın..."
          />
        </label>

        <div style={styles.autoGrid}>
          <label style={styles.label}>
            Talep Tipi
            <div style={{
              ...styles.autoField,
              color: autoType ? '#0F172A' : '#94A3B8',
              borderColor: predError ? '#FECACA' : '#CBD5E1',
            }}>
              {predicting ? 'Analiz ediliyor...' : predError ? 'Bağlantı hatası' : autoType || '—'}
            </div>
          </label>

          <label style={styles.label}>
            Kategori
            <div style={{
              ...styles.autoField,
              color: autoCategory ? '#0F172A' : '#94A3B8',
              borderColor: predError ? '#FECACA' : '#CBD5E1',
            }}>
              {predicting ? 'Analiz ediliyor...' : predError ? 'Bağlantı hatası' : autoCategory || '—'}
            </div>
          </label>
        </div>

        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            opacity: predicting || !autoCategory ? 0.6 : 1,
            cursor:  predicting || !autoCategory ? 'not-allowed' : 'pointer',
          }}
          disabled={predicting || !autoCategory}
        >
          {predicting ? 'Analiz ediliyor...' : 'Talep Gönder'}
        </button>
      </form>
    </>
  );

  // ─── TALEPLERİM paneli ──────────────────────────────────────────────────
  const listPanel = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h1 style={styles.title}>Taleplerim</h1>
        <button style={styles.refreshBtn} onClick={fetchMyTickets}>↻ Yenile</button>
      </div>

      {loadingTickets && <div style={styles.infoBox}>Yükleniyor...</div>}

      {!loadingTickets && myTickets.length === 0 && (
        <div style={styles.emptyBox}>Henüz hiç talebiniz bulunmuyor.</div>
      )}

      {!loadingTickets && myTickets.map(ticket => {
        const ms   = managerStatusLabel(ticket.manager_status);
        const st   = ticketStatusLabel(ticket.status);
        const date = new Date(ticket.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

        return (
          <div key={ticket.id} style={styles.ticketCard}>
            <div style={styles.ticketHeader}>
              <div>
                <div style={styles.ticketTitle}>#{ticket.id} — {ticket.title}</div>
                <div style={styles.ticketMeta}>
                  {ticket.kategori} · {ticket.talep_tipi || '—'} · {date}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {/* Yönetici onay durumu — yalnızca beklemede veya reddedildiyse göster */}
                {ticket.manager_status !== 'onaylandi' && (
                  <span style={{ ...styles.badge, color: ms.color, background: ms.bg, borderColor: ms.border }}>
                    {ms.label}
                  </span>
                )}
                <span style={{ ...styles.badge, color: st.color, background: st.bg, borderColor: st.border }}>
                  {st.label}
                </span>
              </div>
            </div>

            {/* Yönetici red notu */}
            {ticket.manager_status === 'reddedildi' && ticket.manager_note && (
              <div style={styles.noteBox}>
                <strong>Yönetici Notu:</strong> {ticket.manager_note}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  // ─── Bağımsız kullanıcı görünümü — sidebar'lı düzen ─────────────────────
  if (!onBack) {
    const navItems = [
      { key: 'create',   label: 'Talep Oluştur' },
      { key: 'list',      label: 'Taleplerim'     },
      { key: 'settings', label: 'Ayarlar'         },
    ];

    return (
      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarLogo}>TTS</div>

          <div style={styles.sidebarUserInfo}>
            <div style={styles.avatar}>{user?.username?.[0]?.toUpperCase() || 'K'}</div>
            <div style={styles.sidebarUsername}>{user?.username}</div>
            <div style={styles.sidebarRole}>Kullanıcı</div>
            {user?.department && <div style={styles.sidebarDept}>{user.department}</div>}
          </div>

          <nav style={styles.nav}>
            {navItems.map(item => (
              <button
                key={item.key}
                style={{ ...styles.navItem, ...(view === item.key ? styles.navItemActive : {}) }}
                onClick={() => setView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {onLogout && (
            <button style={styles.sidebarLogout} onClick={onLogout}>Çıkış Yap</button>
          )}
        </div>

        <div style={styles.main}>
          {view === 'settings' ? (
            <SettingsPage user={user} onLogout={onLogout} />
          ) : (
            <div style={styles.card}>
              {view === 'create' && createPanel}
              {view === 'list'   && listPanel}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Admin içinde gömülü görünüm (AdminLayout kendi sidebar'ını sağlar) ──
  if (view === 'settings') {
    return <SettingsPage user={user} onLogout={onLogout} onBack={() => setView('create')} />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Üst satır */}
        <div style={styles.topRow}>
          <div style={{ display: 'flex', gap: 12 }}>
            {onBack   && <button style={styles.backBtn}   onClick={onBack}>Geri</button>}
            {onLogout && <button style={styles.logoutBtn} onClick={onLogout}>Çıkış Yap</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...styles.tabBtn, ...(view === 'create' ? styles.tabActive : {}) }}
              onClick={() => setView('create')}
            >
              Talep Oluştur
            </button>
            <button
              style={{ ...styles.tabBtn, ...(view === 'list' ? styles.tabActive : {}) }}
              onClick={() => setView('list')}
            >
              Taleplerim
            </button>
            <button
              style={{ ...styles.tabBtn, ...(view === 'settings' ? styles.tabActive : {}) }}
              onClick={() => setView('settings')}
            >
              Ayarlar
            </button>
          </div>
        </div>

        {view === 'create' && createPanel}
        {view === 'list'   && listPanel}
      </div>
    </div>
  );
}

const styles = {
  page:       { minHeight: '100vh', background: '#F0F4F8', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' },
  card:       { maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15,23,42,0.08)', padding: '2rem' },

  /* Bağımsız kullanıcı görünümü — sidebar'lı düzen */
  layout:          { display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar:         { width: 220, height: '100vh', boxSizing: 'border-box', background: '#0C447C', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', flexShrink: 0 },
  sidebarLogo:     { color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: '1.5rem', paddingLeft: 4 },
  sidebarUserInfo: { paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' },
  avatar:          { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginBottom: 8 },
  sidebarUsername: { color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 2 },
  sidebarRole:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 },
  sidebarDept:     { display: 'inline-block', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12 },
  nav:             { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem:         { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' },
  navItemActive:   { background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 },
  sidebarLogout:   { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left' },
  main:            { flex: 1, background: '#F0F4F8', overflowY: 'auto', padding: '2rem' },
  topRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: '1.75rem', flexWrap: 'wrap' },
  backBtn:    { border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  logoutBtn:  { border: '1px solid #FECACA', background: '#fff', color: '#991B1B', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  title:      { fontSize: 24, fontWeight: 700, margin: '0 0 1.25rem 0', color: '#0F172A' },

  tabBtn:     { padding: '9px 18px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  tabActive:  { background: '#185FA5', color: '#fff', borderColor: '#185FA5' },
  refreshBtn: { padding: '8px 14px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' },

  errorBox:   { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', color: '#991B1B', marginBottom: '1rem' },
  successBox: { background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px', color: '#065F46', marginBottom: '1rem' },
  infoBox:    { background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', color: '#1E40AF', marginBottom: '1rem', textAlign: 'center' },
  emptyBox:   { background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 12, padding: '2rem', color: '#94A3B8', textAlign: 'center', fontSize: 14 },

  form:       { display: 'grid', gap: '1rem' },
  label:      { display: 'grid', gap: 6, fontSize: 13, color: '#475569', fontWeight: 600 },
  input:      { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: 14, outline: 'none', boxSizing: 'border-box' },

  autoGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  autoField: {
    padding: '14px 16px', borderRadius: 12, border: '1px solid #CBD5E1',
    background: '#F1F5F9', fontSize: 14, fontWeight: 600,
    minHeight: 50, display: 'flex', alignItems: 'center',
    letterSpacing: '0.01em', userSelect: 'none',
  },

  submitBtn: { marginTop: '0.5rem', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 18px', fontSize: 15, fontWeight: 700 },

  ticketCard:   { border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '0.75rem', background: '#FAFAFA' },
  ticketHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  ticketTitle:  { fontWeight: 700, color: '#0F172A', fontSize: 15, marginBottom: 4 },
  ticketMeta:   { fontSize: 12, color: '#94A3B8' },
  badge:        { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid', whiteSpace: 'nowrap' },
  noteBox:      { marginTop: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991B1B' },
};
