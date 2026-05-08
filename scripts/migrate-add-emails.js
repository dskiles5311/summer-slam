import { createClient } from '@libsql/client';

const dbUrl = process.env.TURSO_DATABASE_URL || 'libsql://summer-slam-dskiles5311.aws-us-east-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!authToken) {
  console.error('Error: TURSO_AUTH_TOKEN environment variable not set');
  process.exit(1);
}

const client = createClient({ url: dbUrl, authToken });

async function addColumn(table, colDef) {
  const col = colDef.split(' ')[0];
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    console.log(`✓ Added ${col} to ${table}`);
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('already exists')) {
      console.log(`✓ ${col} already exists in ${table}`);
    } else {
      throw e;
    }
  }
}

async function migrate() {
  try {
    console.log('Connecting to Turso database...');
    await addColumn('entries',  "boater_email TEXT DEFAULT ''");
    await addColumn('entries',  "co_angler_email TEXT DEFAULT ''");
    await addColumn('contacts', "email TEXT DEFAULT ''");
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
