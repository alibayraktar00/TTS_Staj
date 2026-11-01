import { useState, useEffect } from 'react';
import api from './api';

const ROLE_LABELS = { admin: 'Admin', manager: 'Yönetici', sub_admin: 'Yardımcı Admin', user: 'Kullanıcı' };

export default function SettingsPage({ user, onLogout, onBack }) {
  const [passForm, setPassForm]       = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg]         = useState('');
  const [passError, setPassError]     = useState('');

  // Sub Admin Yonetimi (sadece admin)
  const [subAdmins,   setSubAdmins]   = useState([]);
  const [saLoading,   setSaLoading]   = useState(false);
  const [createForm,  setCreateForm]  = useState({ username: '', email: '', password: '' });
  const [creating,    setCreating]    = useState(false);
  const [createMsg,   setCreateMsg]   = useState('');
  const [createError, setCreateError] = useState('');

  // Hesabımı Sil (herkes)
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteError,    setDeleteError]    = useState('');

  // Kullanıcı Sil (sadece admin)
  const [allUsers,             setAllUsers]             = useState([]);
  const [deleteUserId,         setDeleteUserId]         = useState('');
  const [deleteUserConfirm,    setDeleteUserConfirm]    = useState('');
  const [deleteUserLoading,    setDeleteUserLoading]    = useState(false);
  const [deleteUserError,      setDeleteUserError]      = useState('');
  const [deleteUserMsg,        setDeleteUserMsg]        = useState('');

  const handlePassChange = (e) => {
    setPassMsg('');
    setPassError('');
    setPassForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePassSubmit = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');
    if (!passForm.current || !passForm.next || !passForm.confirm) {
      setPassError('Tum alanlari doldurun.');
      return;
    }
    if (passForm.next.length < 6) {
      setPassError('Yeni parola en az 6 karakter olmalidir.');
      return;
    }
    if (passForm.next !== passForm.confirm) {
      setPassError('Yeni parolalar eslesmiyor.');
      return;
    }
    setPassLoading(true);
    try {
      const { data } = await api.put('/auth/password', {
        currentPassword: passForm.current,
        newPassword: passForm.next,
      });
      setPassMsg(data.message || 'Parola guncellendi.');
      setPassForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPassError(err.response?.data?.message || 'Parola guncellenemedi.');
    } finally {
      setPassLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSubAdmins();
      fetchAllUsers();
    }
  }, [user]);

  const fetchSubAdmins = async () => {
    setSaLoading(true);
    try {
      const { data } = await api.get('/sub-admins');
      setSubAdmins(data.subAdmins || []);
    } catch (err) {
      console.error('Sub admin listesi alinamadi:', err);
    } finally {
      setSaLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setAllUsers((data.users || []).filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Kullanici listesi alinamadi:', err);
    }
  };

  const selectedDeleteUser = allUsers.find(u => String(u.id) === String(deleteUserId));

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Parolanızı girmelisiniz.');
      return;
    }
    const confirmed = window.confirm(
      'Hesabınızı kalıcı olarak silmek üzeresiniz. Bu işlem GERİ ALINAMAZ ve açtığınız tüm talepler ile yorumlarınız da silinecektir. Devam etmek istiyor musunuz?'
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      await api.delete('/auth/me', { data: { password: deletePassword } });
      if (onLogout) onLogout();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Hesap silinemedi.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setDeleteUserError('');
    setDeleteUserMsg('');

    if (!selectedDeleteUser) {
      setDeleteUserError('Lütfen silinecek kullanıcıyı seçin.');
      return;
    }
    if (deleteUserConfirm !== selectedDeleteUser.username) {
      setDeleteUserError('Onaylamak için kullanıcı adını doğru yazmalısınız.');
      return;
    }
    const confirmed = window.confirm(
      `"${selectedDeleteUser.username}" kullanıcısını kalıcı olarak silmek üzeresiniz. Bu işlem GERİ ALINAMAZ ve kullanıcının tüm talepleri ile yorumları da silinecektir. Devam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    setDeleteUserLoading(true);
    try {
      await api.delete(`/users/${selectedDeleteUser.id}`);
      setDeleteUserMsg(`"${selectedDeleteUser.username}" kullanıcısı silindi.`);
      setDeleteUserId('');
      setDeleteUserConfirm('');
      fetchAllUsers();
    } catch (err) {
      setDeleteUserError(err.response?.data?.message || 'Kullanıcı silinemedi.');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    setCreateMsg('');
    setCreateError('');
    if (!createForm.username || !createForm.email || !createForm.password) {
      setCreateError('Kullanici adi, e-posta ve parola zorunludur.');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Parola en az 6 karakter olmalidir.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/create-sub-admin', createForm);
      setCreateMsg('Yardımcı admin başarıyla oluşturuldu.');
      setCreateForm({ username: '', email: '', password: '' });
      fetchSubAdmins();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Olusturulamadi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Baslik */}
        <div style={styles.topRow}>
          <div>
            {onBack && <button style={styles.backBtn} onClick={onBack}>← Geri</button>}
            <h1 style={styles.title}>Ayarlar</h1>
            <p style={styles.subtitle}>Hesap tercihlerinizi buradan yonetebilirsiniz.</p>
          </div>
          {user && (
            <div style={styles.userChip}>
              <div style={styles.avatar}>{user.username?.[0]?.toUpperCase()}</div>
              <div>
                <div style={styles.chipName}>{user.username}</div>
                <div style={styles.chipRole}>{user.role === 'admin' ? 'Admin' : 'Kullanici'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Yardimci Admin Yonetimi — sadece admin gorur */}
        {user?.role === 'admin' && (
          <>
            {/* Olustur */}
            <div style={{ ...styles.section, marginBottom: '1.25rem' }}>
              <h2 style={styles.sectionTitle}>Yardimci Admin Olustur</h2>
              <p style={styles.sectionDesc}>Sisteme yeni bir yardimci admin (sub_admin) hesabi ekleyin.</p>

              {createMsg   && <div style={styles.successBox}>{createMsg}</div>}
              {createError && <div style={styles.errorBox}>{createError}</div>}

              <form onSubmit={handleCreateSubAdmin} style={styles.passForm} noValidate>
                <div style={styles.twoCol}>
                  <div style={styles.formGroup}>
                    <label style={styles.fieldLabel}>Kullanici Adi *</label>
                    <input style={styles.input} type="text" placeholder="ornek.kullanici"
                      value={createForm.username}
                      onChange={e => setCreateForm(p => ({ ...p, username: e.target.value }))} required />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.fieldLabel}>E-posta *</label>
                    <input style={styles.input} type="email" placeholder="ornek@sirket.com"
                      value={createForm.email}
                      onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} required />
                  </div>
                </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: '1.5rem' }}>
                    <div>
                      <label style={styles.fieldLabel}>Parola</label>
                      <input style={styles.input} type="password" placeholder="En az 6 karakter"
                        value={createForm.password}
                        onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} />
                    </div>
                  </div>
                <button type="submit"
                  style={{ ...styles.saveBtn, opacity: creating ? 0.7 : 1, cursor: creating ? 'not-allowed' : 'pointer' }}
                  disabled={creating}>
                  {creating ? 'Olusturuluyor...' : 'Yardimci Admin Olustur'}
                </button>
              </form>
            </div>

            {/* Liste */}
            <div style={{ ...styles.section, marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Mevcut Yardimci Adminler</h2>
                  <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>Sistemdeki tum yardimci admin hesaplari.</p>
                </div>
                <button onClick={fetchSubAdmins}
                  style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}>
                  Yenile
                </button>
              </div>

              {saLoading ? (
                <div style={{ color: '#64748B', fontSize: 13 }}>Yukleniyor...</div>
              ) : subAdmins.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic', padding: '0.5rem 0' }}>
                  Henuz yardimci admin olusturulmamis. Yukardaki formu kullanin.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['ID', 'Kullanici Adi', 'E-posta'].map(h => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subAdmins.map(sa => (
                        <tr key={sa.id}>
                          <td style={styles.td}>{sa.id}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{sa.username}</td>
                            <td style={styles.td}>{sa.email}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Kullanıcı Sil (Tehlikeli Bölge) */}
            <div style={{ ...styles.dangerSection, marginBottom: '1.25rem' }}>
              <h2 style={styles.dangerTitle}>⚠️ Kullanıcı Sil</h2>
              <p style={styles.dangerDesc}>
                Bir kullanıcıyı kalıcı olarak siler. Bu işlem geri alınamaz: kullanıcının açtığı
                tüm talepler ve yorumları da birlikte silinir.
              </p>

              {deleteUserMsg   && <div style={styles.successBox}>{deleteUserMsg}</div>}
              {deleteUserError && <div style={styles.errorBox}>{deleteUserError}</div>}

              <form onSubmit={handleDeleteUser} style={styles.passForm} noValidate>
                <div style={styles.formGroup}>
                  <label style={styles.fieldLabel}>Silinecek Kullanıcı</label>
                  <select
                    style={styles.input}
                    value={deleteUserId}
                    onChange={e => { setDeleteUserId(e.target.value); setDeleteUserConfirm(''); setDeleteUserError(''); }}
                  >
                    <option value="">Seçiniz...</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.username} ({ROLE_LABELS[u.role] || u.role})</option>
                    ))}
                  </select>
                </div>

                {selectedDeleteUser && (
                  <div style={styles.formGroup}>
                    <label style={styles.fieldLabel}>
                      Onaylamak için "<strong>{selectedDeleteUser.username}</strong>" yazın
                    </label>
                    <input
                      style={styles.input}
                      type="text"
                      value={deleteUserConfirm}
                      onChange={e => setDeleteUserConfirm(e.target.value)}
                      placeholder={selectedDeleteUser.username}
                    />
                  </div>
                )}

                <button type="submit"
                  style={{
                    ...styles.dangerBtn,
                    opacity: deleteUserLoading || !selectedDeleteUser || deleteUserConfirm !== selectedDeleteUser?.username ? 0.5 : 1,
                    cursor: deleteUserLoading || !selectedDeleteUser || deleteUserConfirm !== selectedDeleteUser?.username ? 'not-allowed' : 'pointer',
                  }}
                  disabled={deleteUserLoading || !selectedDeleteUser || deleteUserConfirm !== selectedDeleteUser?.username}>
                  {deleteUserLoading ? 'Siliniyor...' : 'Kullanıcıyı Kalıcı Olarak Sil'}
                </button>
              </form>
            </div>

            <div style={{ height: 1, background: '#E2E8F0', margin: '0 0 1.25rem' }} />
          </>
        )}

        {/* Sifre Degistir */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Sifre Degistir</h2>
          <p style={styles.sectionDesc}>Hesabinizin guvenligi icin sifrenizi duzenli olarak guncelleyin.</p>

          {passMsg   && <div style={styles.successBox}>{passMsg}</div>}
          {passError && <div style={styles.errorBox}>{passError}</div>}

          <form onSubmit={handlePassSubmit} style={styles.passForm} noValidate>
            <div style={styles.formGroup}>
              <label style={styles.fieldLabel}>Mevcut Parola</label>
              <div style={styles.inputWrap}>
                <input style={styles.input} type={showCurrent ? 'text' : 'password'} name="current"
                  value={passForm.current} onChange={handlePassChange} placeholder="Mevcut parolanizi girin" autoComplete="current-password" />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowCurrent(p => !p)}>
                  {showCurrent ? 'Gizle' : 'Goster'}
                </button>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.fieldLabel}>Yeni Parola</label>
              <div style={styles.inputWrap}>
                <input style={styles.input} type={showNext ? 'text' : 'password'} name="next"
                  value={passForm.next} onChange={handlePassChange} placeholder="En az 6 karakter" autoComplete="new-password" />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowNext(p => !p)}>
                  {showNext ? 'Gizle' : 'Goster'}
                </button>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.fieldLabel}>Yeni Parola Tekrar</label>
              <input style={{ ...styles.input, borderColor: passForm.confirm && passForm.confirm !== passForm.next ? '#EF4444' : undefined }}
                type="password" name="confirm" value={passForm.confirm} onChange={handlePassChange}
                placeholder="Yeni parolayi tekrar girin" autoComplete="new-password" />
            </div>

            <button type="submit"
              style={{ ...styles.saveBtn, opacity: passLoading ? 0.7 : 1, cursor: passLoading ? 'not-allowed' : 'pointer' }}
              disabled={passLoading}>
              {passLoading ? 'Guncelleniyor...' : 'Parolayi Guncelle'}
            </button>
          </form>
        </div>

        {/* Hesabımı Sil (Tehlikeli Bölge) */}
        <div style={{ ...styles.dangerSection, marginTop: '1.25rem' }}>
          <h2 style={styles.dangerTitle}>⚠️ Hesabımı Sil</h2>
          <p style={styles.dangerDesc}>
            Hesabınızı kalıcı olarak siler. Bu işlem geri alınamaz: açtığınız tüm talepler ve
            yorumlarınız da birlikte silinir.
          </p>

          {deleteError && <div style={styles.errorBox}>{deleteError}</div>}

          <form onSubmit={handleDeleteAccount} style={styles.passForm} noValidate>
            <div style={styles.formGroup}>
              <label style={styles.fieldLabel}>Onaylamak için parolanızı girin</label>
              <input
                style={styles.input}
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                placeholder="Mevcut parolanız"
                autoComplete="current-password"
              />
            </div>

            <button type="submit"
              style={{ ...styles.dangerBtn, opacity: deleteLoading ? 0.6 : 1, cursor: deleteLoading ? 'not-allowed' : 'pointer' }}
              disabled={deleteLoading}>
              {deleteLoading ? 'Siliniyor...' : 'Hesabımı Kalıcı Olarak Sil'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page:        { padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' },
  card:        { maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 18px 55px rgba(15,23,42,0.08)', padding: '2rem' },
  topRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: '1.75rem', flexWrap: 'wrap' },
  backBtn:     { border: '1px solid #CBD5E1', background: '#fff', color: '#1E293B', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 10, fontFamily: 'inherit' },
  title:       { fontSize: 26, fontWeight: 700, margin: 0, color: '#0F172A' },
  subtitle:    { margin: '6px 0 0', color: '#475569', fontSize: 14 },
  userChip:    { display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px' },
  avatar:      { width: 36, height: 36, background: '#185FA5', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 },
  chipName:    { fontWeight: 600, fontSize: 14, color: '#1E293B' },
  chipRole:    { fontSize: 12, color: '#64748B' },
  section:     { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.5rem' },
  sectionTitle:{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: '0 0 4px' },
  sectionDesc: { fontSize: 13, color: '#64748B', margin: '0 0 1.25rem' },
  dangerSection:{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, padding: '1.5rem' },
  dangerTitle: { fontSize: 15, fontWeight: 700, color: '#991B1B', margin: '0 0 4px' },
  dangerDesc:  { fontSize: 13, color: '#B91C1C', margin: '0 0 1.25rem', lineHeight: 1.6 },
  dangerBtn:   { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, width: 'fit-content', fontFamily: 'inherit' },
  successBox:  { background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px', color: '#065F46', fontSize: 13, marginBottom: '1rem' },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: '1rem' },
  saveBtn:     { background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, width: 'fit-content', cursor: 'pointer', fontFamily: 'inherit' },
  passForm:    { display: 'grid', gap: '1rem' },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  formGroup:   { display: 'grid', gap: 6 },
  fieldLabel:  { fontSize: 13, fontWeight: 600, color: '#475569' },
  inputWrap:   { position: 'relative' },
  input:       { width: '100%', height: 42, padding: '0 80px 0 12px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, color: '#2D3748', outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' },
  eyeBtn:      { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#718096', padding: '2px 6px', fontFamily: 'inherit' },
  th:          { textAlign: 'left', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', borderBottom: '1px solid #E2E8F0' },
  td:          { padding: '10px 12px', borderBottom: '1px solid #F1F5F9', color: '#1F2937', fontSize: 14 },
};


