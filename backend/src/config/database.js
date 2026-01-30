import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, '../../data/stock_tracker.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Wrapper to make SQLite work like mysql2 pool.execute
const pool = {
  execute: async (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = stmt.all(...params);
      return [rows];
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const result = stmt.run(...params);
      return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
    } else {
      const result = stmt.run(...params);
      return [{ affectedRows: result.changes }];
    }
  }
};

const initDatabase = async () => {
  try {
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create alerts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        stock_name TEXT,
        alert_type TEXT CHECK(alert_type IN ('below', 'above')) NOT NULL,
        target_price REAL NOT NULL,
        is_triggered INTEGER DEFAULT 0,
        triggered_at DATETIME NULL,
        triggered_price REAL NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create email_logs table for tracking delivery status
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id INTEGER,
        user_id INTEGER NOT NULL,
        email_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_attempt_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create price_check_logs table for monitoring
    db.exec(`
      CREATE TABLE IF NOT EXISTS price_check_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        status TEXT NOT NULL,
        price REAL,
        source TEXT,
        error_message TEXT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns to users table (if they don't exist)
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = userColumns.map(c => c.name);

    if (!columnNames.includes('email_verified')) {
      db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('verification_token')) {
      db.exec('ALTER TABLE users ADD COLUMN verification_token TEXT');
    }
    if (!columnNames.includes('password_reset_token')) {
      db.exec('ALTER TABLE users ADD COLUMN password_reset_token TEXT');
    }
    if (!columnNames.includes('password_reset_expires')) {
      db.exec('ALTER TABLE users ADD COLUMN password_reset_expires DATETIME');
    }

    console.log('Database initialized successfully (SQLite)');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export { pool, initDatabase, db };
