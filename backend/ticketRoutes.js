const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { verifyToken, verifyAdmin, verifyManager, verifySubAdmin } = require('./authRoutes');
const { ticketCreatedUserMail, ticketCreatedManagerMail, ticketCreatedAdminMail, ticketAssignedSubAdminMail } = require('./mailer');

const DONANIM_CATEGORIES = [
  'AVS',
  'BİLGİSAYAR',
  'DİĞER',
  'EL TERMİNALİ',
  'FAX',
  'İŞLETİM SİSTEMİ',
  'KAMERA SİSTEMİ',
  'NETWORK (LAN-WAN)',
  'PDKS',
  'UPS',
  'YAZICI',
];

const YAZILIM_CATEGORIES = [
  'ABYS',
  'CBS (EDABİS)',
  'CRM',
  'DİĞER',
  'EBYS',
  'EDVARS',
  'PDKS',
  'SAP',
  'SAYAX',
  'WEB SİTESİ',
  'WFM',
];

function getTalepTipi(categoryName) {
  if (DONANIM_CATEGORIES.includes(categoryName)) return 'DONANIM';
  if (YAZILIM_CATEGORIES.includes(categoryName)) return 'YAZILIM';
  return 'DİĞER';
}

const router = express.Router();

// ─── GET /api/categories ──────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json({ categories: rows });
  } catch (err) {
    console.error('Categories fetch hatası:', err);
    res.status(500).json({ message: 'Kategori bilgisi alınamadı.' });
  }
});

// ─── GET /api/dashboard/summary (admin) ──────────────────────────────────────
router.get('/dashboard/summary', verifyAdmin, async (req, res) => {
  try {
    const [totals] = await pool.query(
      `SELECT
        COUNT(*) AS toplam,
        SUM(status = 'open') AS acik,
        SUM(status = 'in_progress') AS islemde,
        SUM(status = 'pending') AS beklemede,
        SUM(status = 'resolved') AS cozuldu
      FROM tickets`
    );

    const [categoryCounts] = await pool.query(
      `SELECT c.name AS name, COUNT(*) AS talep_sayisi
      FROM tickets t
      JOIN categories c ON t.category_id = c.id
      WHERE t.created_at >= NOW() - INTERVAL 7 DAY
      GROUP BY c.name
      ORDER BY talep_sayisi DESC`
    );

    const [commentTotal] = await pool.query('SELECT COUNT(*) AS toplam_yorum FROM ticket_comments');

    res.json({
      summary: { ...(totals[0] || {}), toplam_yorum: commentTotal[0]?.toplam_yorum || 0 },
      categoryCounts,
    });
  } catch (err) {
    console.error('Summary hatası:', err);
    res.status(500).json({ message: 'Dashboard özeti alınamadı.' });
  }
});

// ─── GET /api/tickets/manager/stats  (Yönetici Dashboard İstatistikleri) ─────
router.get('/tickets/manager/stats', verifyManager, async (req, res) => {
  try {
    // Departmanındaki bekleyen / onaylanan / reddedilen sayıları
    const [approval] = await pool.query(
      `SELECT
         SUM(manager_status = 'beklemede')  AS bekleyen,
         SUM(manager_status = 'onaylandi')  AS onaylanan,
         SUM(manager_status = 'reddedildi') AS reddedilen
       FROM tickets
       WHERE manager_id = ?`,
      [req.user.id]
    );
    // Yöneticinin kendi açtığı talepler
    const [own] = await pool.query(
      'SELECT COUNT(*) AS kendi_talep FROM tickets WHERE user_id = ?',
      [req.user.id]
    );
    res.json({
      bekleyen:    approval[0]?.bekleyen    || 0,
      onaylanan:   approval[0]?.onaylanan   || 0,
      reddedilen:  approval[0]?.reddedilen  || 0,
      kendi_talep: own[0]?.kendi_talep      || 0,
    });
  } catch (err) {
    console.error('Manager stats hatası:', err);
    res.status(500).json({ message: 'İstatistikler alınamadı.' });
  }
});

// ─── GET /api/tickets/manager  (Yönetici bekleyen talepleri) ─────────────────
// ÖNEMLİ: Bu route, /tickets/:id'den önce tanımlanmalı, yoksa 'manager' id olarak yorumlanır.
router.get('/tickets/manager', verifyManager, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.manager_note,
              t.created_at, t.description,
              u.username  AS kullanici,
              u.department AS kullanici_departman,
              c.name      AS kategori,
              t.talep_tipi
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.manager_id = ? AND t.manager_status = 'beklemede'
       ORDER BY t.created_at ASC`,
      [req.user.id]
    );
    res.json({ tickets: rows });
  } catch (err) {
    console.error('Manager tickets hatası:', err);
    res.status(500).json({ message: 'Talepler alınamadı.' });
  }
});

// ─── ADMIN: ATANMIŞ TICKETLARI LİSTELE ───────────────────────────────────────
router.get('/admin/assigned-tickets', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.talep_tipi, t.created_at,
              u.username AS kullanici,
              c.name     AS kategori,
              sa.username AS atanan_sub_admin,
              sa.id      AS sub_admin_id
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       JOIN users sa ON t.assigned_sub_admin_id = sa.id
       WHERE t.assigned_sub_admin_id IS NOT NULL
       ORDER BY sa.username ASC, t.created_at DESC`
    );
    const tickets = rows.map(r => ({ ...r, talep_tipi: r.talep_tipi || getTalepTipi(r.kategori) }));
    res.json({ tickets });
  } catch (err) {
    console.error('Atanmış talepler alınırken hata:', err);
    res.status(500).json({ message: 'Veri çekilemedi.' });
  }
});

// ─── YARDIMCI ADMIN (SUB_ADMIN): KENDİNE ATANANLARI GÖRME ─────────────────────
router.get('/tickets/my', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.manager_note,
              t.created_at, t.updated_at,
              c.name    AS kategori,
              t.talep_tipi,
              m.username AS yonetici_adi
       FROM tickets t
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN users m ON t.manager_id = m.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ tickets: rows });
  } catch (err) {
    console.error('My tickets hatası:', err);
    res.status(500).json({ message: 'Talepleriniz alınamadı.' });
  }
});

// ─── GET /api/tickets (admin — tüm talepler) ─────────────────────────────────
router.get('/tickets', verifyAdmin, async (req, res) => {
  const { status, category, type, mine, page = '1', limit = '15' } = req.query;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize    = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
  const offset      = (currentPage - 1) * pageSize;

  const conditions = ['1'];
  const params     = [];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (category) {
    conditions.push('c.name = ?');
    params.push(category);
  }

  if (type) {
    if (type === 'DONANIM') {
      conditions.push(`c.name IN (${DONANIM_CATEGORIES.map(() => '?').join(',')})`);
      params.push(...DONANIM_CATEGORIES);
    } else if (type === 'YAZILIM') {
      conditions.push(`c.name IN (${YAZILIM_CATEGORIES.map(() => '?').join(',')})`);
      params.push(...YAZILIM_CATEGORIES);
    }
  }

  if (mine === '1') {
    conditions.push('t.user_id = ?');
    params.push(req.user.id);
  }

  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.talep_tipi, t.created_at,
              t.assigned_sub_admin_id,
              u.username  AS kullanici,
              c.name      AS kategori,
              m.username  AS yonetici_adi,
              sa.username AS atanan_sub_admin
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN users m  ON t.manager_id = m.id
       LEFT JOIN users sa ON t.assigned_sub_admin_id = sa.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const tickets = rows.map((row) => ({
      ...row,
      talep_tipi: row.talep_tipi || getTalepTipi(row.kategori),
    }));

    res.json({ tickets, total: countRows[0]?.total || 0, page: currentPage, limit: pageSize });
  } catch (err) {
    console.error('Tickets list hatası:', err);
    res.status(500).json({ message: 'Talepler alınamadı.' });
  }
});

// ─── GET /api/tickets/:id (admin veya atanan sub_admin) ─────────────────────────────
router.get('/tickets/:id', verifyToken, async (req, res) => {
  const ticketId = req.params.id;
  const { role, id: userId } = req.user;

  // Sadece admin veya sub_admin erişebilir
  if (role !== 'admin' && role !== 'sub_admin') {
    return res.status(403).json({ message: 'Bu işlem için yetki gereklidir.' });
  }

  try {
    const [ticketRows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.manager_status, t.manager_note,
              t.talep_tipi, t.created_at, t.updated_at,
              t.assigned_sub_admin_id,
              u.username  AS kullanici,
              c.name      AS kategori,
              sa.username AS atanan_sub_admin,
              m.username  AS yonetici_adi
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN users sa ON t.assigned_sub_admin_id = sa.id
       LEFT JOIN users m  ON t.manager_id  = m.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (!ticketRows[0]) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    // Sub admin sadece kendisine atanmış ticketa girebilir
    if (role === 'sub_admin' && ticketRows[0].assigned_sub_admin_id !== userId) {
      return res.status(403).json({ message: 'Bu talep size atanmamış.' });
    }

    ticketRows[0].talep_tipi = ticketRows[0].talep_tipi || getTalepTipi(ticketRows[0].kategori);

    // Yorumlar ve geçmiş paralel çekilir
    const [[comments], [history]] = await Promise.all([
      pool.query(
        `SELECT tc.id, tc.content, tc.created_at, u.username AS yazan
         FROM ticket_comments tc
         JOIN users u ON tc.user_id = u.id
         WHERE tc.ticket_id = ?
         ORDER BY tc.created_at ASC`,
        [ticketId]
      ),
      pool.query(
        `SELECT th.field_name, th.old_value, th.new_value, th.changed_at, u.username AS degistiren
         FROM ticket_history th
         LEFT JOIN users u ON th.changed_by = u.id
         WHERE th.ticket_id = ?
         ORDER BY th.changed_at ASC`,
        [ticketId]
      ),
    ]);

    res.json({ ticket: ticketRows[0], comments, history });
  } catch (err) {
    console.error('Ticket detail hatası:', err);
    res.status(500).json({ message: 'Talep detayı alınamadı.' });
  }
});

// ─── POST /api/tickets  (Talep Oluşturma) ────────────────────────────────────
// verifyToken: admin hariç tüm roller (user, manager) talep açabilir
router.post('/tickets', verifyToken, async (req, res) => {
  const { title, description, category_id, category } = req.body;

  let categoryId   = category_id;
  let categoryName = '';

  if (!categoryId && category) {
    const normalizedCategory = category.trim();
    const [categoryRows] = await pool.query(
      'SELECT id, name FROM categories WHERE LOWER(name) = LOWER(?)',
      [normalizedCategory]
    );
    if (!categoryRows[0]) {
      return res.status(400).json({ message: 'Geçersiz kategori seçildi.' });
    }
    categoryId   = categoryRows[0].id;
    categoryName = categoryRows[0].name;
  } else if (categoryId) {
    const [categoryRows] = await pool.query('SELECT name FROM categories WHERE id = ?', [categoryId]);
    categoryName = categoryRows[0]?.name || '';
  }

  if (!title || !description || !categoryId) {
    return res.status(400).json({ message: 'Başlık, açıklama ve kategori gereklidir.' });
  }

  // talep_tipi hesapla
  const talepTipi = getTalepTipi(categoryName);
  const talepTipiDB = talepTipi === 'DONANIM' ? 'DONANIM' : talepTipi === 'YAZILIM' ? 'YAZILIM' : null;

  try {
    // Kullanıcının departmanını ve e-postasını bul
    const [userRows] = await pool.query(
      'SELECT department, email FROM users WHERE id = ?',
      [req.user.id]
    );
    const userDepartment = userRows[0]?.department || null;
    const userEmail      = userRows[0]?.email || null;

    // Aynı departmandaki yöneticiyi bul
    // Kullanıcı yönetici ise kendisi dışındaki bir yönetici aranır
    let managerId     = null;
    let managerEmail  = null;
    let initialStatus = 'open';
    let managerStatus = 'beklemede';

    if (userDepartment) {
      const [managerRows] = await pool.query(
        `SELECT id, email FROM users
         WHERE department = ? AND is_manager = TRUE AND is_active = TRUE AND id != ?
         LIMIT 1`,
        [userDepartment, req.user.id]
      );
      if (managerRows[0]) {
        managerId     = managerRows[0].id;
        managerEmail  = managerRows[0].email;
        initialStatus = 'pending'; // Yönetici onayı bekliyor
      }
    }

    // Yönetici yoksa direkt open (manager_status anlamlı değil ama default 'beklemede')
    if (!managerId) {
      managerStatus = 'onaylandi'; // Yönetici yok → direkt onaylı sayılır
      initialStatus = 'open';
    }

    const [result] = await pool.query(
      `INSERT INTO tickets
         (title, description, category_id, talep_tipi, user_id, manager_id, manager_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, categoryId, talepTipiDB, req.user.id, managerId, managerStatus, initialStatus]
    );

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.talep_tipi, t.created_at,
              u.username AS kullanici,
              c.name     AS kategori,
              m.username AS yonetici_adi
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN users m ON t.manager_id = m.id
       WHERE t.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ ticket: rows[0] });

    // ── Bildirim mailleri ────────────────────────────────────────────────
    // Yanıt zaten gönderildi; mail gönderimi burada başarısız olsa bile
    // talep oluşturma işlemini etkilemez, sadece loglanır.
    (async () => {
      try {
        const tasks = [];
        if (userEmail) {
          tasks.push(ticketCreatedUserMail(rows[0], userEmail));
        }
        if (managerEmail) {
          tasks.push(ticketCreatedManagerMail(rows[0], managerEmail));
        }
        const [adminRows] = await pool.query(
          "SELECT email FROM users WHERE role = 'admin' AND is_active = TRUE"
        );
        adminRows.forEach((a) => tasks.push(ticketCreatedAdminMail(rows[0], a.email)));
        await Promise.allSettled(tasks);
      } catch (err) {
        console.error('Talep bildirim maili gönderilirken hata:', err.message);
      }
    })();
  } catch (err) {
    console.error('Ticket create hatası:', err);
    res.status(500).json({ message: 'Talep kaydedilemedi.' });
  }
});

// ─── PUT /api/tickets/:id/manager-action  (Yönetici Onay/Red) ────────────────
router.put('/tickets/:id/manager-action', verifyManager, async (req, res) => {
  const ticketId = req.params.id;
  const { action, note } = req.body;

  if (!['onaylandi', 'reddedildi'].includes(action)) {
    return res.status(400).json({ message: 'Geçersiz işlem. "onaylandi" veya "reddedildi" olmalıdır.' });
  }

  try {
    // Talep bu yöneticiye mi atanmış?
    const [ticketRows] = await pool.query(
      'SELECT id, manager_id, manager_status, user_id FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (!ticketRows[0]) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    const ticket = ticketRows[0];

    // Sadece admin veya bu talebin atandığı yönetici işlem yapabilir
    if (req.user.role !== 'admin' && ticket.manager_id !== req.user.id) {
      return res.status(403).json({ message: 'Bu talep size atanmamış.' });
    }

    // Zaten işlem yapılmış mı?
    if (ticket.manager_status !== 'beklemede') {
      return res.status(400).json({ message: 'Bu talep zaten işleme alınmış.' });
    }

    const newStatus        = action === 'onaylandi' ? 'open' : 'resolved';
    const newManagerStatus = action;

    await pool.query(
      `UPDATE tickets
       SET manager_status = ?, manager_note = ?, status = ?
       WHERE id = ?`,
      [newManagerStatus, note || null, newStatus, ticketId]
    );

    // Geçmişe kaydet
    await pool.query(
      `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
       VALUES (?, 'manager_status', 'beklemede', ?, ?)`,
      [ticketId, newManagerStatus, req.user.id]
    );

    const [updated] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.manager_note, t.talep_tipi,
              u.username AS kullanici,
              c.name     AS kategori
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [ticketId]
    );

    res.json({ ticket: updated[0] });
  } catch (err) {
    console.error('Manager action hatası:', err);
    res.status(500).json({ message: 'İşlem gerçekleştirilemedi.' });
  }
});

// ─── PATCH /api/tickets/:id  (Admin veya atanan Sub Admin: durum güncelleme) ───
router.patch('/tickets/:id', verifyToken, async (req, res) => {
  const ticketId = req.params.id;
  const { role, id: userId } = req.user;
  const { status } = req.body;

  if (role !== 'admin' && role !== 'sub_admin') {
    return res.status(403).json({ message: 'Bu işlem için admin veya yardımcı admin olmalısınız.' });
  }

  const VALID_STATUSES = ['open', 'in_progress', 'pending', 'resolved'];

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Geçersiz durum değeri.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT status, assigned_sub_admin_id FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (!existing[0]) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    // Sub Admin sadece kendisine atanmış ticketları güncelleyebilir
    if (role === 'sub_admin' && existing[0].assigned_sub_admin_id !== userId) {
      return res.status(403).json({ message: 'Bu talep size atanmamış.' });
    }

    const old = existing[0];

    if (status !== old.status) {
      await pool.query(
        `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
         VALUES (?, 'status', ?, ?, ?)`,
        [ticketId, old.status, status, userId]
      );
    }

    await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [status, ticketId]);

    const [updated] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.talep_tipi, t.created_at, t.updated_at,
              u.username AS kullanici,
              c.name     AS kategori
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (updated[0]) {
      updated[0].talep_tipi = updated[0].talep_tipi || getTalepTipi(updated[0].kategori);
    }

    res.json({ ticket: updated[0] });
  } catch (err) {
    console.error('Ticket update hatası:', err);
    res.status(500).json({ message: 'Talep güncellenemedi.' });
  }
});

// ─── POST /api/tickets/:id/comments  (Yorum Ekleme — admin veya atanan sub_admin) ──────────────
router.post('/tickets/:id/comments', verifyToken, async (req, res) => {
  const ticketId = req.params.id;
  const { role, id: userId } = req.user;
  const { content } = req.body;

  if (role !== 'admin' && role !== 'sub_admin') {
    return res.status(403).json({ message: 'Bu işlem için yetki gereklidir.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Yorum içeriği boş olamaz.' });
  }

  try {
    const [ticketRows] = await pool.query(
      'SELECT id, assigned_sub_admin_id FROM tickets WHERE id = ?',
      [ticketId]
    );
    if (!ticketRows[0]) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    // Sub admin sadece kendi ticketlarına yorum ekleyebilir
    if (role === 'sub_admin' && ticketRows[0].assigned_sub_admin_id !== userId) {
      return res.status(403).json({ message: 'Bu talep size atanmamış.' });
    }

    const [result] = await pool.query(
      'INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES (?, ?, ?)',
      [ticketId, req.user.id, content.trim()]
    );

    const [newComment] = await pool.query(
      `SELECT tc.id, tc.content, tc.created_at, u.username AS yazan
       FROM ticket_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ comment: newComment[0] });
  } catch (err) {
    console.error('Comment create hatası:', err);
    res.status(500).json({ message: 'Yorum eklenemedi.' });
  }
});

// ─── GET /api/sub-admins  (Tüm Sub Admin kullanıcıları — Admin) ──────────────
router.get('/sub-admins', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email, department
       FROM users
       WHERE role = 'sub_admin' AND is_active = TRUE
       ORDER BY username ASC`
    );
    res.json({ subAdmins: rows });
  } catch (err) {
    console.error('Sub admins fetch hatası:', err);
    res.status(500).json({ message: 'Yardımcı admin listesi alınamadı.' });
  }
});

// ─── GET /api/admin/unassigned-tickets  (Atanmamış, manager onaylı ticketlar) ─
router.get('/admin/unassigned-tickets', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.talep_tipi, t.created_at,
              u.username AS kullanici,
              c.name     AS kategori
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.manager_status = 'onaylandi'
         AND t.assigned_sub_admin_id IS NULL
       ORDER BY t.created_at DESC`
    );
    const tickets = rows.map(r => ({ ...r, talep_tipi: r.talep_tipi || getTalepTipi(r.kategori) }));
    res.json({ tickets });
  } catch (err) {
    console.error('Unassigned tickets hatası:', err);
    res.status(500).json({ message: 'Atanmamış talepler alınamadı.' });
  }
});

// ─── GET /api/sub-admin/tickets  (Sub Admin'in kendine atanmış ticketları) ────
router.get('/sub-admin/tickets', verifySubAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.title,
         t.status,
         t.manager_status,
         t.talep_tipi,
         t.created_at,
         c.name AS kategori,
         u.username AS kullanici,
         (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = t.id) AS yorum_sayisi
       FROM tickets t
       JOIN categories c ON t.category_id = c.id
       JOIN users u ON t.user_id = u.id
       WHERE t.assigned_sub_admin_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    const tickets = rows.map(r => ({ ...r, talep_tipi: r.talep_tipi || getTalepTipi(r.kategori) }));
    res.json({ tickets });
  } catch (err) {
    console.error('Sub admin tickets hatası:', err);
    res.status(500).json({ message: 'Talepler alınamadı.' });
  }
});

// ─── PUT /api/tickets/:id/assign  (Admin: Sub Admin Atama / Değiştirme) ───────
router.put('/tickets/:id/assign', verifyAdmin, async (req, res) => {
  const ticketId   = req.params.id;
  const { subAdminId } = req.body; // null ise atama kaldırılır

  try {
    // Ticket var mı?
    const [ticketRows] = await pool.query(
      `SELECT t.id, t.assigned_sub_admin_id,
              old_sa.username AS eski_sub_admin
       FROM tickets t
       LEFT JOIN users old_sa ON t.assigned_sub_admin_id = old_sa.id
       WHERE t.id = ?`,
      [ticketId]
    );
    if (!ticketRows[0]) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    const ticket        = ticketRows[0];
    const oldSubAdminId = ticket.assigned_sub_admin_id;

    // Yeni sub_admin doğrulaması
    let newSubAdminName  = null;
    let newSubAdminEmail = null;
    if (subAdminId !== null && subAdminId !== undefined) {
      const [saRows] = await pool.query(
        `SELECT id, username, email FROM users WHERE id = ? AND role = 'sub_admin' AND is_active = TRUE`,
        [subAdminId]
      );
      if (!saRows[0]) {
        return res.status(400).json({ message: 'Geçersiz yardımcı admin seçildi.' });
      }
      newSubAdminName  = saRows[0].username;
      newSubAdminEmail = saRows[0].email;
    }

    // Atamayı yap
    await pool.query(
      'UPDATE tickets SET assigned_sub_admin_id = ? WHERE id = ?',
      [subAdminId ?? null, ticketId]
    );

    // History kaydı — ne olduğunu belirle
    let fieldName, oldVal, newVal;

    if (oldSubAdminId === null && subAdminId) {
      fieldName = 'Talep Atandı';
      oldVal    = '—';
      newVal    = newSubAdminName;
    } else if (oldSubAdminId !== null && subAdminId) {
      fieldName = 'Atama Değiştirildi';
      oldVal    = ticket.eski_sub_admin || String(oldSubAdminId);
      newVal    = newSubAdminName;
    } else {
      fieldName = 'Atama Kaldırıldı';
      oldVal    = ticket.eski_sub_admin || String(oldSubAdminId);
      newVal    = '—';
    }

    await pool.query(
      `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [ticketId, fieldName, oldVal, newVal, req.user.id]
    );

    // Güncel ticket döndür
    const [updated] = await pool.query(
      `SELECT t.id, t.title, t.status, t.manager_status, t.talep_tipi, t.created_at,
              t.assigned_sub_admin_id,
              u.username  AS kullanici,
              c.name      AS kategori,
              sa.username AS atanan_sub_admin
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN users sa ON t.assigned_sub_admin_id = sa.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (updated[0]) {
      updated[0].talep_tipi = updated[0].talep_tipi || getTalepTipi(updated[0].kategori);
    }

    res.json({ ticket: updated[0] });

    // ── Bildirim maili — yeni atanan sub admin'e ────────────────────────────
    if (newSubAdminEmail) {
      ticketAssignedSubAdminMail(updated[0], newSubAdminEmail).catch((err) => {
        console.error('Atama bildirim maili gönderilirken hata:', err.message);
      });
    }
  } catch (err) {
    console.error('Ticket assign hatası:', err);
    res.status(500).json({ message: 'Atama yapılamadı.' });
  }
});

// ─── POST /api/admin/create-sub-admin  (Admin: Sub Admin Oluşturma) ───────────
router.post('/admin/create-sub-admin', verifyAdmin, async (req, res) => {
  const { username, email, password, department } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Kullanıcı adı, e-posta ve parola zorunludur.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Parola en az 6 karakter olmalıdır.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Bu e-posta veya kullanıcı adı zaten kayıtlı.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, role, department, is_manager)
       VALUES (?, ?, ?, 'sub_admin', ?, 0)`,
      [username, email, hashed, department || null]
    );

    res.status(201).json({ message: 'Yardımcı admin oluşturuldu.', userId: result.insertId });
  } catch (err) {
    console.error('Create sub admin hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
});

module.exports = { router, getTalepTipi, DONANIM_CATEGORIES, YAZILIM_CATEGORIES };

