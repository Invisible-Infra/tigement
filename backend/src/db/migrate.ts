import fs from 'fs';
import path from 'path';
import pool from './index';

export async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log('🔄 Running database migrations...');

  for (const file of files) {
    console.log(`  📄 Executing ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query(sql);
      console.log(`  ✅ ${file} completed`);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (error.code === '42P07' || error.message.includes('already exists')) {
        console.log(`  ⏭️  ${file} skipped (already exists)`);
      } else {
        console.error(`  ❌ Error in ${file}:`, error.message);
        throw error;
      }
    }
  }

  console.log('✅ All migrations completed');
}

