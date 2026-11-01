const express = require('express');
const { pool } = require('./db');
const { verifyAdmin } = require('./authRoutes');

const router = express.Router();

const VALID_ROLES = ['admin', 'manager', 'user', 'sub_admin'];

// ─── GET /api/users  (Admin: tüm kullanıcıları listele) ──────────────────────
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email, role, department, is_manager, is_active, created_at, last_login
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('Users fetch hatası:', err);
    res.status(500).json({ message: 'Kullanıcılar alınamadı.' });
  }
});

// ─── PATCH /api/users/:id  (Admin: rol / departman / aktiflik güncelle) ──────
router.patch('/users/:id', verifyAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const { role, department, is_active } = req.body;

  // Admin kendi hesabını bu ekrandan değiştiremez — yanlışlıkla kendini
  // pasif yapıp sistemden kilitlenmesini önler.
  if (targetId === req.user.id) {
    return res.status(400).json({ message: 'Kendi hesabınızı buradan güncelleyemezsiniz.' });
  }

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Geçersiz rol.' });
  }

  const setClauses = [];
  const params = [];

  if (role !== undefined) {
    setClauses.push('role = ?', 'is_manager = ?');
    params.push(role, role === 'manager' ? 1 : 0);
  }
  if (department !== undefined) {
    setClauses.push('department = ?');
    params.push(department || null);
  }
  if (is_active !== undefined) {
    setClauses.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ message: 'Güncellenecek alan belirtilmedi.' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    await pool.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, [...params, targetId]);

    const [updated] = await pool.query(
      `SELECT id, username, email, role, department, is_manager, is_active, created_at, last_login
       FROM users WHERE id = ?`,
      [targetId]
    );
    res.json({ user: updated[0] });
  } catch (err) {
    console.error('User update hatası:', err);
    res.status(500).json({ message: 'Kullanıcı güncellenemedi.' });
  }
});

// ─── DELETE /api/users/:id  (Admin: Kullanıcı Silme) ─────────────────────────
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.user.id) {
    return res.status(400).json({
      message: 'Kendi hesabınızı buradan silemezsiniz. Ayarlar sayfasındaki "Hesabımı Sil" bölümünü kullanın.',
    });
  }

  try {
    const [existing] = await pool.query('SELECT role FROM users WHERE id = ?', [targetId]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    if (existing[0].role === 'admin') {
      const [otherAdmins] = await pool.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND id != ?",
        [targetId]
      );
      if (otherAdmins[0].count === 0) {
        return res.status(400).json({ message: 'Sistemdeki tek admin silinemez.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [targetId]);

    res.json({ message: 'Kullanıcı silindi.', userId: targetId });
  } catch (err) {
    console.error('User delete hatası:', err);
    res.status(500).json({ message: 'Kullanıcı silinemedi.' });
  }
});

module.exports = { router };
