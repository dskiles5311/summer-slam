CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boater_first  TEXT DEFAULT '',
  boater_last   TEXT DEFAULT '',
  co_angler_first TEXT DEFAULT '',
  co_angler_last  TEXT DEFAULT '',
  boat_no       TEXT DEFAULT '',
  num_fish      INTEGER DEFAULT 0,
  lunker_weight REAL DEFAULT 0,
  total_weight  REAL DEFAULT 0,
  lunker        INTEGER,
  option_field  INTEGER,
  paid          INTEGER,
  app_signed    INTEGER,
  buy_in        REAL DEFAULT 0,
  raw_weight    REAL DEFAULT NULL,
  dead_fish     INTEGER DEFAULT 0,
  short_fish    INTEGER DEFAULT 0,
  needs_attention INTEGER DEFAULT 0
);

-- Migration for existing databases (run once against Turso):
-- ALTER TABLE entries ADD COLUMN raw_weight REAL DEFAULT NULL;
-- ALTER TABLE entries ADD COLUMN dead_fish INTEGER DEFAULT 0;
-- ALTER TABLE entries ADD COLUMN short_fish INTEGER DEFAULT 0;
-- ALTER TABLE entries ADD COLUMN needs_attention INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('fees',           '{"entryFee":249,"lunkerFee":10,"optFee":20}'),
  ('payoutSettings', '{"totalPayout":0,"numWinners":10,"payouts":[]}'),
  ('theme',          '"dark"');
