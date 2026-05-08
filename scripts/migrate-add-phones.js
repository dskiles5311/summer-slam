import { createClient } from '@libsql/client';

// Migration: Add phone fields to entries and create contacts table
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

    // 1. Add phone fields to entries table (if not already present)
    console.log('Adding phone fields to entries table...');
    try {
      await client.execute('ALTER TABLE entries ADD COLUMN boaterPhone TEXT');
      console.log('✓ Added boaterPhone column');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ boaterPhone column already exists');
      } else {
        throw e;
      }
    }

    try {
      await client.execute('ALTER TABLE entries ADD COLUMN coAnglerPhone TEXT');
      console.log('✓ Added coAnglerPhone column');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ coAnglerPhone column already exists');
      } else {
        throw e;
      }
    }

    // 2. Create contacts table (for auto-suggest)
    console.log('Creating contacts table...');
    try {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          boaterFirst TEXT NOT NULL,
          boaterLast TEXT NOT NULL,
          boaterPhone TEXT,
          coAnglerFirst TEXT,
          coAnglerLast TEXT,
          coAnglerPhone TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastUsed DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Created contacts table');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ contacts table already exists');
      } else {
        throw e;
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
