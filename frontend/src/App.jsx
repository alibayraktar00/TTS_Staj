import { useState } from 'react';
import LoginPage           from './LoginPage';
import AdminLayout         from './AdminLayout';
import Dashboard           from './Dashboard';
import TalepPage           from './TalepPage';
import TicketListPage      from './TicketListPage';
import TicketDetailPage    from './TicketDetailPage';
import SettingsPage        from './SettingsPage';
import ManagerPage         from './ManagerPage';
import SubAdminPage        from './SubAdminPage';
import SubAdminManagePage  from './SubAdminManagePage';
import UserManagePage      from './UserManagePage';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [page, setPage]                         = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.role === 'admin')         setPage('dashboard');
    else if (userData.role === 'manager')  setPage('manager');
    else if (userData.role === 'sub_admin') setPage('sub_admin_panel');
    else setPage('create');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPage('dashboard');
  };

  const handleNavigate = (target) => {
    setSelectedTicketId(null);
    setPage(target);
  };

  const goToTicketDetail = (ticketId) => {
    setSelectedTicketId(ticketId);
    setPage('detail');
  };

  const goToTicketList = () => {
    setSelectedTicketId(null);
    setPage('list');
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  // ── Yönetici (manager) görünümü ───────────────────────────────────────────────
  if (user.role === 'manager') {
    return <ManagerPage user={user} onLogout={handleLogout} />;
  }

  // ── Yardımcı Admin (sub_admin) görünümü ──────────────────────────────────────
  if (user.role === 'sub_admin') {
    return <SubAdminPage user={user} onLogout={handleLogout} />;
  }

  // ── Normal kullanıcı görünümü ────────────────────────────────────────────
  if (user.role !== 'admin') {
    return <TalepPage user={user} onBack={null} onLogout={handleLogout} />;
  }

  // ── Admin görünümü ────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            onLogout={handleLogout}
            onViewTicket={goToTicketDetail}
            onViewTickets={() => handleNavigate('list')}
          />
        );
      case 'list':        return <TicketListPage onViewTicket={goToTicketDetail} />;
      case 'detail':      return <TicketDetailPage ticketId={selectedTicketId} onBack={goToTicketList} />;
      case 'create':      return <TalepPage user={user} onBack={() => handleNavigate('dashboard')} />;
      case 'settings':    return <SettingsPage user={user} onLogout={handleLogout} />;
      case 'sub_admins':  return <SubAdminManagePage />;
      case 'users':       return <UserManagePage user={user} />;
      default:            return null;
    }
  };

  return (
    <AdminLayout page={page} onNavigate={handleNavigate} onLogout={handleLogout} user={user}>
      {renderPage()}
    </AdminLayout>
  );
}
