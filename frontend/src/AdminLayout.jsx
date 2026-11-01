import Sidebar from './Sidebar';

export default function AdminLayout({ page, onNavigate, onLogout, user, children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar page={page} onNavigate={onNavigate} onLogout={onLogout} user={user} />
      <div style={{ flex: 1, background: '#F0F4F8', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
