const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('./db');

const router = express.Router();

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Erişim reddedildi: Token bulunamadı.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [decoded.id]);
    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ message: 'Hesabınız pasif durumda. Lütfen yöneticinizle iletişime geçin.' });
    }

    req.user = decoded; // Sonraki handler'lara kullanıcı bilgisini ekle
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş token.' });
  }
}

function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlemi gerçekleştirmek için admin olmalısınız.' });
    }
    next();
  });
}

// Yönetici veya admin erişimi
function verifyManager(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gereklidir.' });
    }
    next();
  });
}

// Yardımcı admin veya admin erişimi
function verifySubAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'sub_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yardımcı admin yetkisi gereklidir.' });
    }
    next();
  });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password, department } = req.body;

  // Güvenlik: rol istemciden asla alınmaz. Herkes 'user' olarak kaydolur;
  // yönetici/admin/yardımcı admin yetkisi yalnızca bir admin tarafından
  // Kullanıcı Yönetimi ekranından atanabilir.
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Tüm alanlar zorunludur.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Parola en az 6 karakter olmalıdır.' });
  }

  try {
    // Kullanıcı zaten var mı?
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Bu e-posta veya kullanıcı adı zaten kayıtlı.' });
    }

    // Parolayı hashle (10 rounds = güvenli + makul hız)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Veritabanına kaydet
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, role, department, is_manager) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 'user', department || null, 0]
    );

    res.status(201).json({
      message: 'Kayıt başarılı!',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Register hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!username || !password) {
    return res.status(400).json({ message: 'Kullanıcı adı ve parola gereklidir.' });
  }

  try {
    // Kullanıcıyı bul (username veya email ile giriş yapılabilir)
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
      [username, username]
    );

    const user = rows[0];
    const success = user && await bcrypt.compare(password, user.password);

    // Giriş logunu kaydet
    await pool.query(
      'INSERT INTO login_logs (user_id, username, ip_address, success) VALUES (?, ?, ?, ?)',
      [user?.id || null, username, ip, success ? 1 : 0]
    );

    if (!success) {
      return res.status(401).json({ message: 'Kullanıcı adı veya parola hatalı.' });
    }

    // Son giriş zamanını güncelle
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // JWT token üret — department ve is_manager bilgisini de ekle
    const token = jwt.sign(
      {
        id:         user.id,
        username:   user.username,
        role:       user.role,
        department: user.department,
        is_manager: !!user.is_manager,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Giriş başarılı!',
      token,
      user: {
        id:         user.id,
        username:   user.username,
        email:      user.email,
        role:       user.role,
        department: user.department,
        is_manager: !!user.is_manager,
      }
    });
  } catch (err) {
    console.error('Login hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
  }
});

// ─── GET /api/auth/me  (korumalı rota) ───────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, department, is_manager, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Me hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// JWT stateless'dır; client token'ı silince oturum biter.
router.post('/logout', verifyToken, (req, res) => {
  res.json({ message: 'Çıkış başarılı. Token client tarafında silindi.' });
});

// ─── PUT /api/auth/password  (Şifre Değiştirme) ─────────────────────────────
router.put('/password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Mevcut ve yeni parola gereklidir.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Yeni parola en az 6 karakter olmalıdır.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) {
      return res.status(401).json({ message: 'Mevcut parola hatalı.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Parola başarıyla güncellendi.' });
  } catch (err) {
    console.error('Password change hatası:', err);
    res.status(500).json({ message: 'Parola güncellenemedi.' });
  }
});

// ─── DELETE /api/auth/me  (Kendi Hesabını Silme) ─────────────────────────────
router.delete('/me', verifyToken, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Hesabınızı silmek için parolanızı girmelisiniz.' });
  }

  try {
    const [rows] = await pool.query('SELECT password, role FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) {
      return res.status(401).json({ message: 'Parola hatalı.' });
    }

    if (rows[0].role === 'admin') {
      const [otherAdmins] = await pool.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND id != ?",
        [req.user.id]
      );
      if (otherAdmins[0].count === 0) {
        return res.status(400).json({ message: 'Sistemde tek admin sizsiniz, hesabınızı silemezsiniz.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.json({ message: 'Hesabınız silindi.' });
  } catch (err) {
    console.error('Hesap silme hatası:', err);
    res.status(500).json({ message: 'Hesap silinemedi.' });
  }
});

module.exports = { router, verifyToken, verifyAdmin, verifyManager, verifySubAdmin };
