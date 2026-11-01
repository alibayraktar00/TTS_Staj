// Demo/test verisi: her rolden bir hesap ve farklı durumlarda örnek talepler.
// Yalnızca yerel geliştirme ve sunum içindir; üretim veritabanında çalıştırılmamalı.
// Kullanım: node seed_demo.js   (tekrar çalıştırılırsa demo verisi sıfırdan kurulur)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

// Tüm demo hesaplarının ortak şifresi
const DEMO_PASSWORD = 'Demo1234!';

// Bildirim mailleri gerçek bir adrese gitsin diye GMAIL_USER'ın "+etiket"li
// alt adresleri kullanılıyor (ör. ad+demo_admin@gmail.com); hepsi aynı kutuya düşer.
function demoEmail(tag) {
  const [local, domain] = (process.env.GMAIL_USER || 'demo@example.com').split('@');
  return `${local}+${tag}@${domain}`;
}

const USERS = [
  { username: 'demo_admin',     role: 'admin',     department: 'Bilgi Teknolojileri', is_manager: 0 },
  { username: 'demo_yonetici',  role: 'manager',   department: 'Muhasebe',            is_manager: 1 },
  { username: 'demo_teknisyen', role: 'sub_admin', department: 'Bilgi Teknolojileri', is_manager: 0 },
  { username: 'demo_kullanici', role: 'user',      department: 'Muhasebe',            is_manager: 0 },
];

// [başlık, açıklama, kategori, talep tipi, durum, yönetici kararı, teknisyene atanmış mı]
const TICKETS = [
  ['Yazıcı kağıt sıkıştırıyor', 'Muhasebe katındaki yazıcıda sürekli kağıt sıkışıyor, çıktı alınamıyor.', 'YAZICI', 'DONANIM', 'pending', 'beklemede', false],
  ['SAP oturumu açılmıyor', 'SAP GUI giriş ekranında yetki hatası alıyorum.', 'SAP', 'YAZILIM', 'open', 'onaylandi', false],
  ['İnternet bağlantısı kopuyor', 'Gün içinde ağ bağlantısı birkaç kez kopuyor.', 'NETWORK (LAN-WAN)', 'DONANIM', 'in_progress', 'onaylandi', true],
  ['EBYS belge imzalanamıyor', 'Elektronik imza ile belge onaylarken hata veriyor.', 'EBYS', 'YAZILIM', 'resolved', 'onaylandi', true],
  ['Yeni monitör talebi', 'Mevcut monitör görüntü vermiyor, değişim gerekiyor.', 'BİLGİSAYAR', 'DONANIM', 'resolved', 'reddedildi', false],
];

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Önceki demo verisini temizle (talepler, yorumlar ve geçmiş CASCADE ile silinir)
    const names = USERS.map((u) => u.username);
    await conn.query('DELETE t FROM tickets t JOIN users u ON t.user_id = u.id WHERE u.username IN (?)', [names]);
    await conn.query('DELETE FROM users WHERE username IN (?)', [names]);

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const ids = {};
    for (const u of USERS) {
      const [r] = await conn.query(
        'INSERT INTO users (username, email, password, role, department, is_manager) VALUES (?, ?, ?, ?, ?, ?)',
        [u.username, demoEmail(u.username), hash, u.role, u.department, u.is_manager]
      );
      ids[u.username] = r.insertId;
    }

    const [cats] = await conn.query('SELECT id, name FROM categories');
    const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));

    for (const [title, description, category, tip, status, managerStatus, assigned] of TICKETS) {
      const [r] = await conn.query(
        `INSERT INTO tickets
           (user_id, category_id, talep_tipi, manager_id, manager_status, manager_note,
            assigned_sub_admin_id, title, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ids.demo_kullanici, catId[category], tip, ids.demo_yonetici, managerStatus,
         managerStatus === 'reddedildi' ? 'Bu yıl bütçede monitör yenileme yok.' : null,
         assigned ? ids.demo_teknisyen : null, title, description, status]
      );
      const ticketId = r.insertId;

      if (managerStatus !== 'beklemede') {
        await conn.query(
          `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
           VALUES (?, 'manager_status', 'beklemede', ?, ?)`,
          [ticketId, managerStatus, ids.demo_yonetici]
        );
      }
      if (assigned) {
        await conn.query(
          `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
           VALUES (?, 'Talep Atandı', '—', 'demo_teknisyen', ?)`,
          [ticketId, ids.demo_admin]
        );
        await conn.query(
          `INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value, changed_by)
           VALUES (?, 'status', 'open', ?, ?)`,
          [ticketId, status, ids.demo_teknisyen]
        );
        await conn.query(
          'INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES (?, ?, ?)',
          [ticketId, ids.demo_teknisyen, 'Talebinizi aldım, inceliyorum.']
        );
      }
    }

    await conn.commit();
    console.log(`Demo verisi hazır: ${USERS.length} kullanıcı, ${TICKETS.length} talep.`);
    console.log(`Hesaplar: ${names.join(', ')} (şifre: seed_demo.js içindeki DEMO_PASSWORD)`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed hatası:', err.message);
  process.exit(1);
});
