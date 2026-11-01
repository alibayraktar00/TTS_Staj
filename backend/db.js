const mysql = require('mysql2/promise');
require('dotenv').config();

// Bağlantı havuzu oluştur (connection pool)
// Tek bağlantı yerine havuz kullanmak daha performanslı ve güvenlidir
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tts_db',
  waitForConnections: true,
  connectionLimit: 10,   
  queueLimit: 0
});

// Bağlantıyı test eden yardımcı fonksiyon
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL bağlantısı başarılı!');
    conn.release(); // Bağlantıyı havuza geri ver
  } catch (err) {
    console.error('❌ MySQL bağlantı hatası:', err.message);
    process.exit(1); // Bağlantı yoksa uygulamayı durdur
  }
}

module.exports = { pool, testConnection };

