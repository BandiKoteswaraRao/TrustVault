import bcrypt from 'bcryptjs';
import { getDb } from './index.js';
import { runMigrations } from './migrate.js';

export async function seedDatabase() {
  console.log('Ensuring migrations are applied before seeding...');
  await runMigrations();

  const db = await getDb();
  console.log('Seeding initial demo users...');

  const ownerPasswordHash = await bcrypt.hash('DemoOwner123!', 12);
  const recipientPasswordHash = await bcrypt.hash('DemoRecipient123!', 12);

  // Check if owner exists
  const existing = await db.query('SELECT id FROM users WHERE email = $1', ['demo.owner@trustvault.local']);
  if (existing.rowCount === 0) {
    await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)`,
      ['demo.owner@trustvault.local', ownerPasswordHash, 'Alice VaultOwner', 'user']
    );
    console.log('Seeded demo owner: demo.owner@trustvault.local (Alice VaultOwner)');
  }

  const existingRecip = await db.query('SELECT id FROM users WHERE email = $1', ['demo.recipient@trustvault.local']);
  if (existingRecip.rowCount === 0) {
    await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)`,
      ['demo.recipient@trustvault.local', recipientPasswordHash, 'Bob Recipient', 'user']
    );
    console.log('Seeded demo recipient: demo.recipient@trustvault.local (Bob Recipient)');
  }

  console.log('Database seeding completed successfully.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
