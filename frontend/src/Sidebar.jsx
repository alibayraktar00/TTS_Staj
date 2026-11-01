export default function Sidebar({ page, onNavigate, onLogout }) {
  const items = [
    { key: 'dashboard',   label: 'Gösterge Paneli' },
    { key: 'list',        label: 'Talepler'         },
    { key: 'sub_admins',  label: 'Yardımcı Adminler'},
    { key: 'users',       label: 'Kullanıcılar'    },
    { key: 'settings',    label: 'Ayarlar'          },
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>TTS</div>
      <nav style={styles.nav}>
        {items.map(item => (
          <button
            key={item.key}
            style={{ ...styles.navItem, ...(page === item.key ? styles.navItemActive : {}) }}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button style={styles.logoutBtn} onClick={onLogout}>Çıkış Yap</button>
    </div>
  );
}

const styles = {
  sidebar:       { width: 220, height: '100vh', boxSizing: 'border-box', background: '#0C447C', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', flexShrink: 0 },
  logo:          { color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: '2rem', paddingLeft: 4 },
  nav:           { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem:       { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' },
  navItemActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 },
  logoutBtn:     { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', textAlign: 'left' },
};
