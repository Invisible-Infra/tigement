import fs from 'fs';
import path from 'path';
import pool from './index';

/**
 * Check if a migration file contains destructive operations
 */
function isDestructiveMigration(filename: string, sql: string): boolean {
  // Files explicitly marked as destructive
  const destructiveFiles = [
    '031_drop_plaintext_columns.sql',
    'drop_plaintext_columns',
    'drop_',
  ];
  
  if (destructiveFiles.some(pattern => filename.includes(pattern))) {
    return true;
  }
  
  // Check SQL content for destructive operations
  const upperSql = sql.toUpperCase();
  const destructiveKeywords = [
    'DROP COLUMN',
    'DROP TABLE',
    'DROP DATABASE',
    'DELETE FROM',
    'TRUNCATE',
  ];
  
  return destructiveKeywords.some(keyword => upperSql.includes(keyword));
}

export async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const DESTRUCTIVE_MIGRATIONS_ALLOWED = process.env.DESTRUCTIVE_MIGRATIONS_ALLOWED === 'true';

  console.log('🔄 Running database migrations...');
  console.log(`⚙️  DESTRUCTIVE_MIGRATIONS_ALLOWED: ${DESTRUCTIVE_MIGRATIONS_ALLOWED}`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Check if this is a destructive migration
    if (isDestructiveMigration(file, sql)) {
      if (!DESTRUCTIVE_MIGRATIONS_ALLOWED) {
        console.warn(`  ⚠️  Skipping DESTRUCTIVE migration ${file}`);
        console.warn(`  💡 Set DESTRUCTIVE_MIGRATIONS_ALLOWED=true to run this migration`);
        continue;
      } else {
        console.warn(`  ⚠️  Running DESTRUCTIVE migration ${file} (DESTRUCTIVE_MIGRATIONS_ALLOWED is set)`);
      }
    }
    
    console.log(`  📄 Executing ${file}...`);
    
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

