import fs from 'fs';
import path from 'path';
import { getDb } from './index.js';

export async function runMigrations(): Promise<string[]> {
  const db = await getDb();
  const applied: string[] = [];

  // 1. Ensure migrations table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Discover migration files
  const migrationsDir = path.resolve(process.cwd(), '../database/migrations');
  const fallbackMigrationsDir = path.resolve(process.cwd(), 'database/migrations');
  const activeDir = fs.existsSync(migrationsDir) ? migrationsDir : fallbackMigrationsDir;

  if (!fs.existsSync(activeDir)) {
    console.warn(`Migrations directory not found at: ${activeDir}`);
    return applied;
  }

  const files = fs.readdirSync(activeDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // 3. Get applied migrations
  const { rows } = await db.query<{ migration_name: string }>(
    'SELECT migration_name FROM schema_migrations'
  );
  const appliedSet = new Set(rows.map(r => r.migration_name));

  // 4. Apply each unapplied migration in order
  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    const filePath = path.join(activeDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Applying migration: ${file}...`);
    await db.transaction(async (tx) => {
      // Execute migration SQL using exec
      await tx.exec(sql);
      // Record migration
      await tx.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [file]
      );
    });

    console.log(`Applied migration: ${file}`);
    applied.push(file);
  }

  return applied;
}

// Allow running directly via CLI
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then((applied) => {
      console.log(`Migration finished. Applied ${applied.length} new migrations.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
