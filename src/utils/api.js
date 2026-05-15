const BASE = '/api';
const SESSION_PW_KEY = 'ss_password';

function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

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
    boaterPhone:    raw.boater_phone    ?? raw.boaterPhone    ?? '',
    boaterEmail:    raw.boater_email    ?? raw.boaterEmail    ?? '',
    coAnglerFirst:  raw.co_angler_first ?? raw.coAnglerFirst  ?? '',
    coAnglerLast:   raw.co_angler_last  ?? raw.coAnglerLast   ?? '',
    coAnglerPhone:  raw.co_angler_phone ?? raw.coAnglerPhone  ?? '',
    coAnglerEmail:  raw.co_angler_email ?? raw.coAnglerEmail  ?? '',
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
    weighedAt:      raw.weighed_at    ?? raw.weighedAt    ?? null,
    updatedAt:      raw.updated_at    ?? raw.updatedAt    ?? null,
    signedUpAt:     raw.signed_up_at  ?? raw.signedUpAt  ?? null,
    checkedInAt:    raw.checked_in_at ?? raw.checkedInAt ?? null,
    offWaterAt:     raw.off_water_at  ?? raw.offWaterAt  ?? null,
  };
}

export async function verifyPassword(password) {
  const res = await fetchWithTimeout(`${BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Invalid password');
}

export async function revalidatePassword() {
  const pw = sessionStorage.getItem(SESSION_PW_KEY);
  if (!pw) return false;
  try {
    await verifyPassword(pw);
    return true;
  } catch {
    clearPassword();
    return false;
  }
}

export async function fetchEntries() {
  const res = await fetchWithTimeout(`${BASE}/entries`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch entries');
  const data = await res.json();
  return data.map(parseEntry);
}

export async function createEntry(entry) {
  const res = await fetchWithTimeout(`${BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to create entry');
  return parseEntry(await res.json());
}

export async function updateEntry(id, entry) {
  const res = await fetchWithTimeout(`${BASE}/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (res.status === 409) {
    const err = new Error('Entry was modified by another device.');
    err.isConflict = true;
    throw err;
  }
  if (!res.ok) throw new Error('Failed to update entry');
  return parseEntry(await res.json());
}

export async function deleteEntry(id) {
  const res = await fetchWithTimeout(`${BASE}/entries/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function clearWeighLog() {
  const res = await fetchWithTimeout(`${BASE}/entries/clear-weigh-log`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear weigh-in log');
}

export async function clearSignUpLog() {
  const res = await fetchWithTimeout(`${BASE}/entries/clear-signup-log`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear sign-up log');
}

export async function clearCheckInLog() {
  const res = await fetchWithTimeout(`${BASE}/entries/clear-checkin-log`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear check-in log');
}

export async function clearCheckOutLog() {
  const res = await fetchWithTimeout(`${BASE}/entries/clear-checkout-log`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear check-out log');
}

export async function fetchSettings() {
  const res = await fetchWithTimeout(`${BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettings(updates) {
  const res = await fetchWithTimeout(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to save settings');
}

export async function fetchContacts() {
  try {
    const res = await fetchWithTimeout(`${BASE}/contacts`, { headers: authHeaders() });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function updateContact(id, { phone, email }) {
  const res = await fetchWithTimeout(`${BASE}/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ phone, email }),
  });
  if (!res.ok) throw new Error('Failed to update contact');
  return res.json();
}

export async function deleteContact(id) {
  const res = await fetchWithTimeout(`${BASE}/contacts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete contact');
}

export async function searchContacts(q) {
  if (!q || q.length < 2) return [];
  try {
    const res = await fetchWithTimeout(`${BASE}/contacts?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function fetchArchiveYears() {
  const res = await fetchWithTimeout(`${BASE}/archive`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch archive years');
  return res.json();
}

export async function fetchArchive(year) {
  const res = await fetchWithTimeout(`${BASE}/archive/${encodeURIComponent(year)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch archive');
  return res.json();
}

export async function archiveEntries(year, entries) {
  const res = await fetchWithTimeout(`${BASE}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ year, entries }),
  });
  if (!res.ok) throw new Error('Failed to archive entries');
  return res.json();
}

export async function backfillPhones() {
  const res = await fetchWithTimeout(`${BASE}/entries/backfill-phones`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to backfill phones');
  return res.json();
}

export async function normalizePhones() {
  const res = await fetchWithTimeout(`${BASE}/entries/normalize-phones`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function clearAllEntries() {
  const res = await fetchWithTimeout(`${BASE}/entries`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear entries');
}

export async function createEntriesBulk(entries) {
  const res = await fetchWithTimeout(`${BASE}/entries/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error('Failed to bulk-create entries');
  return res.json();
}

export async function upsertContacts(people) {
  const valid = people.filter(p => p.firstName && p.lastName);
  if (!valid.length) return;
  await Promise.all(valid.map(p =>
    fetchWithTimeout(`${BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ firstName: p.firstName, lastName: p.lastName, phone: p.phone || '', email: p.email || '', ...(p.oldFirstName ? { oldFirstName: p.oldFirstName, oldLastName: p.oldLastName } : {}) }),
    }).catch(() => {})
  ));
}
