CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boater_first  TEXT DEFAULT '',
  boater_last   TEXT DEFAULT '',
  boater_phone  TEXT DEFAULT '',
  boater_email  TEXT DEFAULT '',
  co_angler_first TEXT DEFAULT '',
  co_angler_last  TEXT DEFAULT '',
  co_angler_phone TEXT DEFAULT '',
  co_angler_email TEXT DEFAULT '',
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

-- Persists across tournament seasons (not cleared with entries)
CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(first_name, last_name)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('fees',           '{"entryFee":249,"lunkerFee":10,"optFee":20}'),
  ('payoutSettings', '{"totalPayout":10500,"numWinners":17,"minPayout":255,"payouts":[4000,1000,800,600,500,360,350,340,330,320,295,280,275,270,265,260,255]}'),
  ('theme',          '"dark"');
