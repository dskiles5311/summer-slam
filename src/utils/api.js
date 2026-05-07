const BASE = '/api';
const SESSION_PW_KEY = 'ss_password';

export function storePassword(pw) { sessionStorage.setItem(SESSION_PW_KEY, pw); }
export function clearPassword() { sessionStorage.removeItem(SESSION_PW_KEY); }
export function isPasswordStored() { return !!sessionStorage.getItem(SESSION_PW_KEY); }

function authHeaders() {
  const pw = sessionStorage.getItem(SESSION_PW_KEY);
  return pw ? { Authorization: `Bearer ${pw}` } : {};
}

function parseEntry(raw) {
  return {
    id: Number(raw.id),
    boaterFirst:    raw.boater_first    ?? raw.boaterFirst    ?? '',
    boaterLast:     raw.boater_last     ?? raw.boaterLast     ?? '',
    coAnglerFirst:  raw.co_angler_first ?? raw.coAnglerFirst  ?? '',
    coAnglerLast:   raw.co_angler_last  ?? raw.coAnglerLast   ?? '',
    boatNo:         raw.boat_no         ?? raw.boatNo         ?? '',
    numFish:        raw.num_fish        ?? raw.numFish        ?? 0,
    lunkerWeight:   raw.lunker_weight   ?? raw.lunkerWeight   ?? 0,
    totalWeight:    raw.total_weight    ?? raw.totalWeight    ?? 0,
    lunker:         Number(raw.lunker                         ?? 0),
    option:         Number(raw.option_field ?? raw.option     ?? 0),
    paid:           Number(raw.paid                           ?? 0),
    appSigned:      Number(raw.app_signed   ?? raw.appSigned  ?? 0),
    buyIn:          raw.buy_in          ?? raw.buyIn          ?? 0,
    rawWeight:      raw.raw_weight      ?? raw.rawWeight      ?? null,
    deadFish:       raw.dead_fish       ?? raw.deadFish       ?? 0,
    shortFish:      raw.short_fish      ?? raw.shortFish      ?? 0,
    needsAttention: Boolean(raw.needs_attention ?? raw.needsAttention ?? false),
  };
}

export async function verifyPassword(password) {
  const res = await fetch(`${BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Invalid password');
}

export async function fetchEntries() {
  const res = await fetch(`${BASE}/entries`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  const data = await res.json();
  return data.map(parseEntry);
}

export async function createEntry(entry) {
  const res = await fetch(`${BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to create entry');
  return parseEntry(await res.json());
}

export async function updateEntry(id, entry) {
  const res = await fetch(`${BASE}/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return parseEntry(await res.json());
}

export async function deleteEntry(id) {
  const res = await fetch(`${BASE}/entries/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function fetchSettings() {
  const res = await fetch(`${BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettings(updates) {
  const res = await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to save settings');
}
