import { useState, useEffect } from 'react';
import api from './api';

const STATUS_LABELS = { open: 'Açık', in_progress: 'İşlemde', pending: 'Beklemede', resolved: 'Çözüldü' };
const STATUS_COLORS = { open: '#F59E0B', in_progress: '#1D9E75', pending: '#0EA5E9', resolved: '#10B981' };

export default function Dashboard({ user, onLogout, onViewTicket, onViewTickets }) {
  // logout App.jsx üzerinden yönetiliyor
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({ toplam: 0, acik: 0, islemde: 0, beklemede: 0, cozuldu: 0, toplam_yorum: 0 });
  const [categorySummary, setCategorySummary] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const ticketSummary = [
    { label: 'Toplam Talep', value: summary.toplam, color: '#185FA5', icon: '📊' },
    { label: 'Açık', value: summary.acik, color: '#F59E0B', icon: '🟠' },
    { label: 'İşlemde', value: summary.islemde,color: '#1D9E75', icon: '🟢' },
    { label: 'Beklemede', value: summary.beklemede, color: '#0EA5E9', icon: '🔵' },
    { label: 'Çözüldü', value: summary.cozuldu, color: '#10B981', icon: '✅' },
    { label: 'Toplam Yorum', value: summary.toplam_yorum, color: '#9D174D', icon: '💬' },
  ];

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setProfile(res.data.user))
      .catch(() => {});

    api.get('/dashboard/summary')
      .then(res => {
        setSummary(res.data.summary || {});
        setCategorySummary(res.data.categoryCounts || []);
      })
      .catch(() => {});

    api.get('/tickets', { params: { limit: 5, page: 1 } })
      .then(res => setRecentTickets(res.data.tickets || []))
      .catch(() => setRecentTickets([]))
      .finally(() => setLoadingRecent(false));
  }, []);

  const barWidth = (count) => summary.toplam > 0 ? `${Math.round((count / summary.toplam) * 100)}%` : '0%';

  const statusRows = [
    { label: 'Açık',      count: summary.acik,     color: STATUS_COLORS.open },
    { label: 'İşlemde',   count: summary.islemde,  color: STATUS_COLORS.in_progress },
    { label: 'Beklemede', count: summary.beklemede, color: STATUS_COLORS.pending },
    { label: 'Çözüldü',   count: summary.cozuldu,  color: STATUS_COLORS.resolved },
  ];

  return (
    <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Gösterge Paneli</h1>
            <p style={styles.pageSubtitle}>Hoş geldiniz, {user.username}!</p>
          </div>
          <div style={styles.userBadge}>
            <span style={styles.userAvatar}>{user.username[0].toUpperCase()}</span>
            <div>
              <div style={styles.userName}>{user.username}</div>
              <div style={styles.userRole}>{user.role === 'admin' ? 'Admin' : 'Kullanıcı'}</div>
            </div>
          </div>
        </div>

        {/* Metrik kartlar */}
        <div style={styles.metrics}>
          {ticketSummary.map(m => (
            <div key={m.label} style={styles.metricCard}>
              <div style={{ fontSize: 28 }}>{m.icon}</div>
              <div style={{ ...styles.metricValue, color: m.color }}>{m.value}</div>
              <div style={styles.metricLabel}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Durum Dağılımı + Son Aktivite */}
        <div style={styles.sectionGrid}>
          <div style={styles.ticketsCard}>
            <h2 style={styles.cardTitle}>📊 Durum Dağılımı</h2>
            {statusRows.map(row => (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div style={styles.barRow}>
                  <span style={{ fontWeight: 600 }}>{row.label}</span>
                  <span>{row.count} <span style={{ color: '#94A3B8' }}>/ {summary.toplam}</span></span>
                </div>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, width: barWidth(row.count), background: row.color }} />
                </div>
              </div>
            ))}
          </div>

          <div style={styles.ticketsCard}>
            <h2 style={styles.cardTitle}>🕐 Son Aktivite</h2>
            {loadingRecent ? (
              <div style={{ color: '#94A3B8', fontSize: 14 }}>Yükleniyor...</div>
            ) : recentTickets.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '1.5rem 0' }}>Henüz talep yok</div>
            ) : (
              recentTickets.map(t => (
                <div
                  key={t.id}
                  style={styles.activityRow}
                  onClick={() => onViewTicket && onViewTicket(t.id)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[t.status] || '#64748B', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.activityTitle}>{t.title}</div>
                    <div style={styles.activityMeta}>{t.kategori} · {new Date(t.created_at).toLocaleDateString('tr-TR')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[t.status] || '#64748B', flexShrink: 0 }}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
              ))
            )}
            {onViewTickets && (
              <button style={styles.seeAllBtn} onClick={onViewTickets}>Tümünü Gör</button>
            )}
          </div>
        </div>

        <div style={styles.sectionGrid}>
          <div style={styles.ticketsCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Talep Süreçleri</h2>
              <p style={styles.cardSubtitle}>Son 7 günde gelen taleplerin kategorileri ve durumları.</p>
            </div>
            <div style={styles.statusRow}>
              {(categorySummary.length > 0 ? categorySummary : [
                { name: 'Yazılım', talep_sayisi: 0 },
                { name: 'Donanım', talep_sayisi: 0 }
              ]).map((category) => (
                <div key={category.name} style={styles.statusCard}>
                  <div style={styles.statusLabel}>{category.name}</div>
                  <div style={styles.statusValue}>{category.talep_sayisi}</div>
                  <div style={styles.statusNote}>Talep</div>
                </div>
              ))}
            </div>
          </div>

          {profile && (
            <div style={styles.profileCard}>
              <h2 style={styles.cardTitle}>Hesap Bilgileri</h2>
              <table style={styles.table}>
                <tbody>
                  {[
                    ['Kullanıcı ID',   profile.id],
                    ['Kullanıcı Adı',  profile.username],
                    ['E-posta',        profile.email],
                    ['Rol',            profile.role === 'admin' ? 'Admin' : 'Kullanıcı'],
                    ['Kayıt Tarihi',   new Date(profile.created_at).toLocaleString('tr-TR')],
                    ['Son Giriş',      profile.last_login ? new Date(profile.last_login).toLocaleString('tr-TR') : '—'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={styles.tdKey}>{k}</td>
                      <td style={styles.tdVal}>{v}</td>
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

const styles = {
  content: { padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#1A202C', margin: 0 },
  pageSubtitle: { fontSize: 14, color: '#718096', margin: '4px 0 0' },

  userBadge: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '10px 16px', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  userAvatar: { width: 36, height: 36, background: '#185FA5', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 },
  userName: { fontWeight: 600, fontSize: 14, color: '#2D3748' },
  userRole: { fontSize: 12, color: '#718096' },

  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: '1.5rem' },
  metricCard: {
    background: '#fff', borderRadius: 10, padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center'
  },
  metricValue: { fontSize: 28, fontWeight: 700, margin: '8px 0 4px' },
  metricLabel: { fontSize: 13, color: '#718096' },

  sectionGrid: { display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, marginBottom: '1.5rem' },
  ticketsCard: { background: '#fff', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '1rem' },
  cardSubtitle: { margin: 0, fontSize: 13, color: '#718096', lineHeight: 1.6 },
  statusRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  statusCard: { background: '#F8FAFC', borderRadius: 10, padding: '1rem', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)' },
  statusLabel: { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 },
  statusValue: { fontSize: 22, fontWeight: 700, color: '#0F172A' },
  statusNote: { fontSize: 12, color: '#64748B' },
  profileCard: { background: '#fff', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#2D3748', margin: '0 0 1rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tdKey: { padding: '10px 0', fontSize: 13, color: '#718096', width: '40%', borderBottom: '1px solid #EDF2F7' },
  tdVal: { padding: '10px 0', fontSize: 14, color: '#2D3748', fontWeight: 500, borderBottom: '1px solid #EDF2F7' },

  // Durum dağılımı çubukları
  barRow:  { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 5 },
  barTrack:{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.6s ease' },

  // Son aktivite listesi
  activityRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' },
  activityTitle:{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  activityMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  seeAllBtn: {
    width: '100%', marginTop: 10, background: 'none', border: '1px solid #E2E8F0',
    borderRadius: 8, padding: '8px', fontSize: 13, color: '#185FA5', cursor: 'pointer',
    fontWeight: 600, fontFamily: 'inherit',
  },
};
