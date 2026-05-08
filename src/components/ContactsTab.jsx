import { useState, useEffect, useRef } from 'react';
import { upsertContacts } from '../utils/api';

const FIELD_STYLE = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 15,
  padding: '9px 12px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

function csvEscape(val) {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n'))
    return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur);
  return cols;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return lines.slice(1)
    .map(line => {
      const cols = parseCsvLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
      return {
        firstName: row.firstname || row.first    || '',
        lastName:  row.lastname  || row.last     || '',
        phone:     row.phone     || '',
        email:     row.email     || '',
      };
    })
    .filter(r => r.firstName && r.lastName);
}

function EditModal({ contact, onSave, onCancel }) {
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email);
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef(null);
  const overlayDownRef = useRef(false);

  useEffect(() => { phoneRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(contact.id, { phone: phone.trim(), email: email.trim() });
    setSaving(false);
  }

  return (
    <div
      className="edit-overlay"
      onPointerDown={e => { overlayDownRef.current = e.target === e.currentTarget; }}
      onPointerUp={e => { if (overlayDownRef.current && e.target === e.currentTarget) onCancel(); }}
    >
      <div className="edit-panel" style={{ maxWidth: 420 }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>Edit Contact</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>
          <p style={{ color: 'var(--gold-light)', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
            {contact.firstName} {contact.lastName}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, display: 'block' }}>Phone</label>
              <input ref={phoneRef} type="tel" value={phone} placeholder="(555) 123-4567"
                     onChange={e => setPhone(e.target.value)} style={FIELD_STYLE} />
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, display: 'block' }}>Email</label>
              <input type="email" value={email} placeholder="angler@example.com"
                     onChange={e => setEmail(e.target.value)} style={FIELD_STYLE} />
            </div>
            <div className="edit-panel-actions">
              <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn btn-gold btn-lg" disabled={saving}>
                {saving ? 'Saving…' : '✔ Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ContactsTab({ isUnlocked, fetchContacts, updateContact, deleteContact }) {
  const [contacts, setContacts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('');
  const [editing, setEditing]         = useState(null);
  const [sortKey, setSortKey]         = useState(() => localStorage.getItem('ss_contacts_sort_key') || 'lastName');
  const [sortDir, setSortDir]         = useState(() => localStorage.getItem('ss_contacts_sort_dir') || 'asc');
  const [importStatus, setImportStatus] = useState(null); // { type: 'loading'|'success'|'error', msg }
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('ss_contacts_sort_key', sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem('ss_contacts_sort_dir', sortDir); }, [sortDir]);

  useEffect(() => {
    fetchContacts().then(data => { setContacts(data); setLoading(false); });
  }, [fetchContacts]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const displayed = contacts
    .filter(c => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = sortKey === 'firstName' ? a.firstName : a.lastName;
      const bv = sortKey === 'firstName' ? b.firstName : b.lastName;
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  async function handleSave(id, updates) {
    const updated = await updateContact(id, updates);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    setEditing(null);
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from contacts?`)) return;
    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  }

  function handleExport() {
    const rows = [['FirstName', 'LastName', 'Phone', 'Email']];
    contacts.forEach(c => rows.push([
      csvEscape(c.firstName), csvEscape(c.lastName),
      csvEscape(c.phone),     csvEscape(c.email),
    ]));
    const csv = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summer-slam-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);

    if (!parsed.length) {
      setImportStatus({ type: 'error', msg: 'No valid contacts found. Ensure the CSV has FirstName and LastName columns.' });
      setTimeout(() => setImportStatus(null), 5000);
      return;
    }

    setImportStatus({ type: 'loading', msg: `Importing ${parsed.length} contacts…` });
    try {
      await upsertContacts(parsed);
      const refreshed = await fetchContacts();
      setContacts(refreshed);
      setImportStatus({ type: 'success', msg: `✓ Imported ${parsed.length} contact${parsed.length !== 1 ? 's' : ''}` });
      setTimeout(() => setImportStatus(null), 4000);
    } catch {
      setImportStatus({ type: 'error', msg: 'Import failed — check the file format and try again.' });
      setTimeout(() => setImportStatus(null), 5000);
    }
  }

  const statusColor = importStatus?.type === 'success' ? '#4CAF50'
                    : importStatus?.type === 'error'   ? '#ff6b6b'
                    : 'var(--gold-light)';

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--header-bg)' }}>
          <strong style={{ color: 'var(--gold-light)' }}>{displayed.length}</strong>
          {filter ? ` of ${contacts.length}` : ''} contacts
        </span>

        {importStatus && (
          <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>
            {importStatus.msg}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        <input
          type="search"
          placeholder="Filter by name, phone, email…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(139,180,225,0.3)',
            borderRadius: 8,
            color: 'var(--white)',
            fontSize: 14,
            padding: '7px 12px',
            flex: '1 1 120px',
            maxWidth: 220,
            minWidth: 0,
            outline: 'none',
          }}
        />

        {isUnlocked && (
          <>
            <button className="btn btn-outline btn-sm" onClick={handleExport}
                    title="Download all contacts as CSV">
              ⬇ Export
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}
                    title="Import contacts from CSV (FirstName, LastName, Phone, Email)">
              ⬆ Import
            </button>
          </>
        )}
      </div>

      <div className="table-wrapper">
        <table className="contacts-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {[
                { key: 'firstName', label: 'First Name', width: '20%' },
                { key: 'lastName',  label: 'Last Name',  width: '18%' },
              ].map(({ key, label, width }) => (
                <th key={key} style={{ width, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => toggleSort(key)}>
                  {label}
                  <span style={{ marginLeft: 5, opacity: sortKey === key ? 1 : 0.3, fontSize: 11 }}>
                    {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                  </span>
                </th>
              ))}
              <th style={{ width: '25%' }}>Phone</th>
              <th className="col-email" style={{ width: '25%' }}>Email</th>
              {isUnlocked && <th style={{ width: 100, textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isUnlocked ? 5 : 4} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={isUnlocked ? 5 : 4} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
                {filter ? 'No contacts match your filter.' : 'No contacts yet — they are saved automatically when signing up anglers.'}
              </td></tr>
            ) : displayed.map(c => (
              <tr key={c.id}>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName}</td>
                <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastName}</td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.phone
                    ? <a href={`tel:${c.phone}`} style={{ color: 'var(--water-light)', textDecoration: 'none' }}>{c.phone}</a>
                    : <span style={{ color: 'var(--header-bg)' }}>—</span>}
                </td>
                <td className="col-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.email
                    ? <a href={`mailto:${c.email}`} style={{ color: 'var(--water-light)', textDecoration: 'none' }}>{c.email}</a>
                    : <span style={{ color: 'var(--header-bg)' }}>—</span>}
                </td>
                {isUnlocked && (
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm"
                            style={{ padding: '3px 8px', fontSize: 12, marginRight: 4 }}
                            onClick={() => setEditing(c)}>✏️</button>
                    <button className="btn btn-outline btn-sm"
                            style={{ color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.4)', padding: '3px 8px', fontSize: 12 }}
                            onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          contact={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
