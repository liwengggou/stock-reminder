import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// Convert MySQL-style ? placeholders to PostgreSQL $1, $2, etc.
const convertPlaceholders = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

// Add execute method for MySQL compatibility
const originalQuery = pool.query.bind(pool);
pool.execute = async (sql, params = []) => {
  let pgSql = convertPlaceholders(sql);
  const sqlUpper = sql.trim().toUpperCase();

  // For INSERT statements, add RETURNING id to get the inserted ID
  if (sqlUpper.startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
    pgSql = pgSql.replace(/;?\s*$/, ' RETURNING id');
  }

  const result = await originalQuery(pgSql, params);

  // Return in MySQL-compatible format
  if (sqlUpper.startsWith('INSERT')) {
    return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount }];
  }
  if (sqlUpper.startsWith('DELETE') || sqlUpper.startsWith('UPDATE')) {
    return [{ affectedRows: result.rowCount }];
  }
  return [result.rows];
};

// For compatibility with any code using db.prepare()
const db = {
  prepare: (sql) => ({
    all: async (...params) => {
      const result = await originalQuery(convertPlaceholders(sql), params);
      return result.rows;
    },
    run: async (...params) => {
      const result = await originalQuery(convertPlaceholders(sql), params);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    },
    get: async (...params) => {
      const result = await originalQuery(convertPlaceholders(sql), params);
      return result.rows[0];
    }
  })
};

const initDatabase = async () => {
  try {
    // Create users table
    await originalQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        password_reset_token TEXT,
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create alerts table
    await originalQuery(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        stock_name TEXT,
        alert_type TEXT CHECK(alert_type IN ('below', 'above')) NOT NULL,
        target_price REAL NOT NULL,
        is_triggered BOOLEAN DEFAULT FALSE,
        triggered_at TIMESTAMP NULL,
        triggered_price REAL NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create email_logs table
    await originalQuery(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create price_check_logs table
    await originalQuery(`
      CREATE TABLE IF NOT EXISTS price_check_logs (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        status TEXT NOT NULL,
        price REAL,
        source TEXT,
        error_message TEXT,
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully (PostgreSQL/Neon)');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export { pool, initDatabase, db };
