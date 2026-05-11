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

    console.log('Creating contacts_new with updated schema...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS contacts_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL COLLATE NOCASE,
        last_name  TEXT NOT NULL COLLATE NOCASE,
        phone      TEXT DEFAULT '',
        email      TEXT DEFAULT '',
        last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(first_name, last_name, phone)
      )
    `);

    // OR IGNORE silently drops any rows that collide after COLLATE NOCASE is applied
    // (i.e., case-variant duplicates like "john smith" vs "John Smith")
    const result = await client.execute(`
      INSERT OR IGNORE INTO contacts_new (id, first_name, last_name, phone, email, last_seen)
      SELECT id,
             TRIM(first_name),
             TRIM(last_name),
             TRIM(COALESCE(phone, '')),
             TRIM(COALESCE(email, '')),
             last_seen
      FROM contacts
      ORDER BY last_seen DESC
    `);
    console.log(`✓ Copied ${result.rowsAffected} contacts (case-variant duplicates merged)`);

    await client.execute(`DROP TABLE contacts`);
    await client.execute(`ALTER TABLE contacts_new RENAME TO contacts`);
    console.log('✓ contacts table rebuilt: case-insensitive names, phone as unique tiebreaker');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
