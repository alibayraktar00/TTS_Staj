CREATE DATABASE IF NOT EXISTS tts_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_turkish_ci;

USE tts_db;

CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50)  NOT NULL UNIQUE,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('admin', 'user', 'manager') NOT NULL DEFAULT 'user',
  department   VARCHAR(100) NULL,
  is_manager   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login   DATETIME NULL
);

CREATE TABLE IF NOT EXISTS login_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  username   VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success    BOOLEAN NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  category_id    INT NOT NULL,
  talep_tipi     ENUM('DONANIM','YAZILIM') NULL,
  assigned_to    INT NULL,
  manager_id     INT NULL,
  manager_status ENUM('beklemede','onaylandi','reddedildi') NOT NULL DEFAULT 'beklemede',
  manager_note   TEXT NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  status         ENUM('open','in_progress','pending','resolved') NOT NULL DEFAULT 'open',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tickets_user_id    (user_id),
  INDEX idx_tickets_category_id(category_id),
  INDEX idx_tickets_status     (status),
  INDEX idx_tickets_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value VARCHAR(255) NULL,
  new_value VARCHAR(255) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by INT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT IGNORE INTO categories (name) VALUES
  ('AVS'),
  ('BİLGİSAYAR'),
  ('DİĞER'),
  ('EL TERMİNALİ'),
  ('FAX'),
  ('İŞLETİM SİSTEMİ'),
  ('KAMERA SİSTEMİ'),
  ('NETWORK (LAN-WAN)'),
  ('PDKS'),
  ('UPS'),
  ('YAZICI'),
  ('ABYS'),
  ('CBS (EDABİS)'),
  ('CRM'),
  ('EBYS'),
  ('EDVARS'),
  ('SAP'),
  ('SAYAX'),
  ('WEB SİTESİ'),
  ('WFM');

-- ─── MIGRATION: Mevcut veritabanı için ALTER TABLE ────────────────────────────
-- Bu blok yalnızca veritabanı zaten oluşturulmuşsa çalıştırılmalıdır.
-- Yeni kurulumda CREATE TABLE zaten güncel şemayı içeriyor.

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','user','manager') NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL   AFTER role,
  ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT FALSE AFTER department;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS talep_tipi     ENUM('DONANIM','YAZILIM') NULL              AFTER category_id,
  ADD COLUMN IF NOT EXISTS manager_id     INT NULL                                    AFTER assigned_to,
  ADD COLUMN IF NOT EXISTS manager_status ENUM('beklemede','onaylandi','reddedildi')
                                          NOT NULL DEFAULT 'beklemede'                AFTER manager_id,
  ADD COLUMN IF NOT EXISTS manager_note   TEXT NULL                                   AFTER manager_status;

-- Foreign key yalnızca yoksa eklenir (MySQL 8+ için)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tickets'
    AND COLUMN_NAME  = 'manager_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_tickets_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── MIGRATION: Sub Admin sistemi ────────────────────────────────────────────
-- users.role ENUM'una 'sub_admin' ekleniyor
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','user','manager','sub_admin') NOT NULL DEFAULT 'user';

-- tickets tablosuna assigned_sub_admin_id kolonu ekleniyor
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS assigned_sub_admin_id INT NULL AFTER assigned_to;

-- Foreign key yalnızca yoksa eklenir
SET @fk_sa_exists = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tickets'
    AND COLUMN_NAME  = 'assigned_sub_admin_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);

SET @sql_sa = IF(@fk_sa_exists = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_tickets_sub_admin FOREIGN KEY (assigned_sub_admin_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_sa FROM @sql_sa;
EXECUTE stmt_sa;
DEALLOCATE PREPARE stmt_sa;
