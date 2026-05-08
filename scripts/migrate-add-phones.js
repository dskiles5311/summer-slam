import { createClient } from '@libsql/client';

const dbUrl = 'libsql://summer-slam-dskiles5311.aws-us-east-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!authToken) {
  console.error('Error: TURSO_AUTH_TOKEN environment variable not set');
  process.exit(1);
}

const client = createClient({ url: dbUrl, authToken });

async function migrate() {
  try {
    console.log('Connecting to Turso database...');

    // 1. Add phone fields to entries table
    console.log('Adding phone fields to entries table...');
    for (const col of ['boater_phone TEXT', 'co_angler_phone TEXT']) {
      try {
        await client.execute(`ALTER TABLE entries ADD COLUMN ${col}`);
        console.log(`✓ Added ${col.split(' ')[0]} column`);
      } catch (e) {
        if (e.message?.includes('duplicate') || e.message?.includes('already exists')) {
          console.log(`✓ ${col.split(' ')[0]} column already exists`);
        } else {
          throw e;
        }
      }
    }

    // 2. Create contacts table (individual people for auto-suggest, persists across tournaments)
    console.log('Creating contacts table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name  TEXT NOT NULL,
        phone      TEXT DEFAULT '',
        last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(first_name, last_name)
      )
    `);
    console.log('✓ contacts table ready');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
