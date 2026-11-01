import { useState } from 'react';
import api from './api';

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('login');

  const [loginForm, setLoginForm]       = useState({ username: '', password: '' });
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState('');

  const [regForm, setRegForm]       = useState({ username: '', email: '', password: '', confirm: '', department: '' });
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError]     = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const switchTab = (t) => {
    setTab(t);
    setLoginError('');
    setRegError('');
    setRegSuccess('');
  };

  const handleLoginChange = (e) => {
    setLoginError('');
    setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      setLoginError('Lütfen tüm alanları doldurun.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const { data } = await api.post('/auth/login', {
        username: loginForm.username,
        password: loginForm.password,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Giriş başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegChange = (e) => {
    setRegError('');
    setRegSuccess('');
    const { name, value, type, checked } = e.target;
    setRegForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const { username, email, password, confirm, department } = regForm;

    if (!username || !email || !password || !confirm) {
      setRegError('Lütfen tüm alanları doldurun.');
      return;
    }
    if (!department) {
      setRegError('Lütfen departmanınızı seçin.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRegError('Geçerli bir e-posta adresi girin.');
      return;
    }
    if (password.length < 6) {
      setRegError('Parola en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      setRegError('Parolalar eşleşmiyor.');
      return;
    }

    setRegLoading(true);
    try {
      await api.post('/auth/register', { username, email, password, department });
      setRegSuccess('Hesabınız oluşturuldu. Şimdi giriş yapabilirsiniz.');
      setRegForm({ username: '', email: '', password: '', confirm: '', department: '' });
      setTimeout(() => { setTab('login'); setRegSuccess(''); }, 1500);
    } catch (err) {
      setRegError(err.response?.data?.message || 'Kayıt başarısız. Lütfen tekrar deneyin.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Sol Panel */}
        <div style={styles.leftPanel}>
          <div style={styles.brandRow}>
            <img
              src="/images.jpg"
              alt="KEPSAŞ Logo"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
            <div>
              <div style={styles.brandName}>KEPSAŞ</div>
              <div style={styles.brandSub}>Talep Takip ve Yönetim Platformu</div>
            </div>
          </div>



          <div style={styles.leftFooter}>© 2026 KEPSAŞ · Tüm hakları saklıdır</div>
        </div>

        {/* Sağ Panel */}
        <div style={styles.rightPanel}>

          {/* Sekmeler */}
          <div style={styles.tabs}>
            <button style={{ ...styles.tabBtn, ...(tab === 'login'    ? styles.tabActive : {}) }} onClick={() => switchTab('login')}>
              Giriş Yap
            </button>
            <button style={{ ...styles.tabBtn, ...(tab === 'register' ? styles.tabActive : {}) }} onClick={() => switchTab('register')}>
              Kayıt Ol
            </button>
          </div>

          {/* GİRİŞ FORMU */}
          {tab === 'login' && (
            <>
              <div style={styles.formHeader}>
                <h1 style={styles.formTitle}>Giriş Yap</h1>
                <p style={styles.formSubtitle}>Kurumsal hesabınızla devam edin</p>
              </div>

              {loginError && <div style={styles.errorBox}>{loginError}</div>}

              <form onSubmit={handleLoginSubmit} noValidate>
                <div style={styles.formGroup}>
                  <label style={styles.label}>KULLANICI ADI VEYA E-POSTA</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="username"
                    placeholder="ornek@sirket.com"
                    value={loginForm.username}
                    onChange={handleLoginChange}
                    autoComplete="username"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>PAROLA</label>
                  <div style={styles.inputWrap}>
                    <input
                      style={styles.input}
                      type={showLoginPass ? 'text' : 'password'}
                      name="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      style={styles.toggleBtn}
                      onClick={() => setShowLoginPass(p => !p)}
                    >
                      {showLoginPass ? 'Gizle' : 'Göster'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{ ...styles.submitBtn, opacity: loginLoading ? 0.7 : 1 }}
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>

              <p style={styles.switchHint}>
                Hesabınız yok mu?{' '}
                <button style={styles.switchLink} onClick={() => switchTab('register')}>
                  Kayıt olun
                </button>
              </p>
            </>
          )}

          {/* KAYIT FORMU */}
          {tab === 'register' && (
            <>
              <div style={styles.formHeader}>
                <h1 style={styles.formTitle}>Hesap Oluştur</h1>
                <p style={styles.formSubtitle}>Bilgilerinizi girerek kaydolun</p>
              </div>

              {regError   && <div style={styles.errorBox}>{regError}</div>}
              {regSuccess && <div style={styles.successBox}>{regSuccess}</div>}

              <form onSubmit={handleRegSubmit} noValidate>
                <div style={styles.formGroup}>
                  <label style={styles.label}>KULLANICI ADI</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="username"
                    placeholder="kullanici_adi"
                    value={regForm.username}
                    onChange={handleRegChange}
                    autoComplete="username"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>E-POSTA</label>
                  <input
                    style={styles.input}
                    type="email"
                    name="email"
                    placeholder="ornek@sirket.com"
                    value={regForm.email}
                    onChange={handleRegChange}
                    autoComplete="email"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>DEPARTMAN</label>
                  <select
                    style={styles.select}
                    name="department"
                    value={regForm.department}
                    onChange={handleRegChange}
                  >
                    <option value="">Seçiniz...</option>
                    <option value="IT">IT</option>
                    <option value="Muhasebe">Muhasebe</option>
                    <option value="İnsan Kaynakları">İnsan Kaynakları</option>
                    <option value="Satış">Satış</option>
                    <option value="Operasyon">Operasyon</option>
                    <option value="Lojistik">Lojistik</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>PAROLA</label>
                  <div style={styles.inputWrap}>
                    <input
                      style={styles.input}
                      type={showRegPass ? 'text' : 'password'}
                      name="password"
                      placeholder="En az 6 karakter"
                      value={regForm.password}
                      onChange={handleRegChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      style={styles.toggleBtn}
                      onClick={() => setShowRegPass(p => !p)}
                    >
                      {showRegPass ? 'Gizle' : 'Göster'}
                    </button>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>PAROLA TEKRAR</label>
                  <input
                    style={{
                      ...styles.input,
                      borderColor: regForm.confirm && regForm.confirm !== regForm.password
                        ? '#EF4444' : undefined,
                    }}
                    type="password"
                    name="confirm"
                    placeholder="Parolayı tekrar girin"
                    value={regForm.confirm}
                    onChange={handleRegChange}
                    autoComplete="new-password"
                  />
                </div>



                <button
                  type="submit"
                  style={{ ...styles.submitBtn, background: '#1D9E75', opacity: regLoading ? 0.7 : 1 }}
                  disabled={regLoading}
                >
                  {regLoading ? 'Kayıt yapılıyor...' : 'Hesap Oluştur'}
                </button>
              </form>

              <p style={styles.switchHint}>
                Zaten hesabınız var mı?{' '}
                <button style={styles.switchLink} onClick={() => switchTab('login')}>
                  Giriş yapın
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F0F4F8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    display: 'flex',
    width: '100%',
    maxWidth: 880,
    minHeight: 540,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
  },

  leftPanel: {
    width: '42%',
    background: '#185FA5',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  brandRow:   { display: 'flex', alignItems: 'center', gap: 10 },
  brandName:  { color: '#fff', fontWeight: 600, fontSize: 17 },
  brandSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  features:   { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  leftFooter: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },

  rightPanel: {
    flex: 1,
    background: '#fff',
    padding: '2rem 2.25rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  tabs: {
    display: 'flex',
    background: '#F0F4F8',
    borderRadius: 10,
    padding: 4,
    marginBottom: '1.5rem',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    padding: '9px 0',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    color: '#718096',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#fff',
    color: '#185FA5',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  },

  formHeader:   { marginBottom: '1.25rem' },
  formTitle:    { fontSize: 22, fontWeight: 700, color: '#1A202C', margin: 0 },
  formSubtitle: { fontSize: 13, color: '#718096', marginTop: 4 },

  errorBox:   { background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C53030', marginBottom: '1rem' },
  successBox: { background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#276749', marginBottom: '1rem' },

  formGroup: { marginBottom: '0.85rem' },
  label:     { display: 'block', fontSize: 11, fontWeight: 600, color: '#718096', marginBottom: 5, letterSpacing: '0.4px' },
  inputWrap: { position: 'relative' },
  input:     { width: '100%', height: 42, padding: '0 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, color: '#2D3748', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  select:    { width: '100%', height: 42, padding: '0 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, color: '#2D3748', outline: 'none', background: '#fff', boxSizing: 'border-box' },

  toggleBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: '#718096', padding: '2px 6px',
  },

  submitBtn: {
    width: '100%',
    height: 44,
    background: '#185FA5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },

  switchHint: { marginTop: '1.25rem', textAlign: 'center', fontSize: 13, color: '#718096' },
  switchLink: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#185FA5', fontWeight: 600, padding: 0 },
};
