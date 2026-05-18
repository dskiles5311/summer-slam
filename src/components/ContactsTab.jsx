import { useState, useEffect, useRef, useMemo } from 'react';
import { upsertContacts, fetchContacts } from '../utils/api';
import { formatPhone } from '../utils/phone';

const FIELD_STYLE = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 16,
  padding: '9px 12px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

function formatLastSeen(ts) {
  if (!ts) return '—';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

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

const FIELD_LABEL = { fontSize: 12, fontWeight: 700, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, display: 'block' };

function EditModal({ contact, onSave, onCancel }) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName,  setLastName]  = useState(contact.lastName);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);
  const overlayDownRef = useRef(false);

  useEffect(() => { firstRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    await onSave(contact.id, { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), email: email.trim() });
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
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div className="form-field">
                <label htmlFor="ct-first" style={FIELD_LABEL}>First Name</label>
                <input ref={firstRef} id="ct-first" name="firstName" type="text" value={firstName} placeholder="First"
                       onChange={e => setFirstName(e.target.value)} style={FIELD_STYLE} required />
              </div>
              <div className="form-field">
                <label htmlFor="ct-last" style={FIELD_LABEL}>Last Name</label>
                <input id="ct-last" name="lastName" type="text" value={lastName} placeholder="Last"
                       onChange={e => setLastName(e.target.value)} style={FIELD_STYLE} required />
              </div>
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label htmlFor="ct-phone" style={FIELD_LABEL}>Phone</label>
              <input id="ct-phone" name="phone" type="tel" value={phone} placeholder="555-123-4567"
                     onChange={e => setPhone(e.target.value)}
                     onBlur={e => setPhone(formatPhone(e.target.value))}
                     style={FIELD_STYLE} />
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label htmlFor="ct-email" style={FIELD_LABEL}>Email</label>
              <input id="ct-email" name="email" type="email" value={email} placeholder="angler@example.com"
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

function DuplicateReviewModal({ groups, onDelete, onClose }) {
  const [busy, setBusy] = useState(null); // id currently being deleted

  async function removeSingle(id) {
    setBusy(id);
    try {
      await onDelete(id);
    } finally {
      setBusy(null);
    }
  }

  async function keepOne(group, keepId) {
    try {
      for (const c of group) {
        if (c.id === keepId) continue;
        setBusy(c.id);
        await onDelete(c.id);
      }
    } finally {
      setBusy(null);
    }
  }

  const overlayDownRef = useRef(false);

  if (groups.length === 0) return null;

  return (
    <div
      className="edit-overlay"
      onPointerDown={e => { overlayDownRef.current = e.target === e.currentTarget; }}
      onPointerUp={e => { if (overlayDownRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="edit-panel" style={{ maxWidth: 560 }}>
        <div className="edit-panel-inner" style={{ maxHeight: '80dvh', overflowY: 'auto' }}>
          <div className="edit-panel-header">
            <h3>Duplicate Contacts</h3>
            <button className="edit-panel-close" onClick={onClose}>✕</button>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 13, marginBottom: 20 }}>
            {groups.length} group{groups.length !== 1 ? 's' : ''} share the same name with different info.
            Keep one entry or remove extras individually.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groups.map((group, gi) => (
              <div key={gi} style={{
                border: '1px solid rgba(255,180,80,0.35)',
                borderLeft: '4px solid #ffb450',
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ fontWeight: 700, color: '#ffb450', fontSize: 14, marginBottom: 10 }}>
                  {group[0].firstName} {group[0].lastName}
                  <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--header-bg)', marginLeft: 8 }}>
                    {group.length} entries
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 10px',
                      opacity: busy === c.id ? 0.5 : 1,
                    }}>
                      <div style={{ flex: 1, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ color: c.phone ? 'var(--white)' : 'var(--header-bg)' }}>
                          📞 {c.phone ? formatPhone(c.phone) : <em>no phone</em>}
                        </span>
                        <span style={{ color: c.email ? 'var(--white)' : 'var(--header-bg)' }}>
                          ✉ {c.email || <em>no email</em>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          className="btn btn-gold btn-sm"
                          style={{ fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}
                          disabled={busy !== null}
                          onClick={() => keepOne(group, c.id)}
                          title="Keep this entry and delete all others in this group"
                        >
                          ✓ Keep
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.4)', whiteSpace: 'nowrap' }}
                          disabled={busy !== null}
                          onClick={() => removeSingle(c.id)}
                          title="Delete only this entry"
                        >
                          {busy === c.id ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <button className="btn btn-outline" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactsTab({ isUnlocked, contacts, contactsLoading, onContactsChange, updateContact, deleteContact }) {
  const [filter, setFilter]           = useState('');
  const [editing, setEditing]         = useState(null);
  const [sortKey, setSortKey]         = useState(() => localStorage.getItem('ss_contacts_sort_key') || 'lastName');
  const [sortDir, setSortDir]         = useState(() => localStorage.getItem('ss_contacts_sort_dir') || 'asc');
  const [importStatus, setImportStatus] = useState(null); // { type: 'loading'|'success'|'error', msg }
  const [showDuplicates, setShowDuplicates] = useState(false);
  const fileInputRef = useRef(null);

  const dupGroups = useMemo(() => {
    const map = {};
    contacts.forEach(c => {
      const key = `${c.firstName.trim().toLowerCase()}|${c.lastName.trim().toLowerCase()}|${(c.phone || '').replace(/\D/g, '')}`;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.values(map).filter(g => g.length > 1);
  }, [contacts]);

  useEffect(() => {
    if (showDuplicates && dupGroups.length === 0) setShowDuplicates(false);
  }, [dupGroups.length, showDuplicates]);

  useEffect(() => { localStorage.setItem('ss_contacts_sort_key', sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem('ss_contacts_sort_dir', sortDir); }, [sortDir]);

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
      let cmp;
      if (sortKey === 'lastSeen') {
        const av = a.lastSeen || '';
        const bv = b.lastSeen || '';
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      } else {
        const av = sortKey === 'firstName' ? a.firstName : a.lastName;
        const bv = sortKey === 'firstName' ? b.firstName : b.lastName;
        cmp = av.localeCompare(bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  async function handleSave(id, updates) {
    const updated = await updateContact(id, updates);
    onContactsChange(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    setEditing(null);
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from contacts?`)) return;
    try {
      await deleteContact(id);
      onContactsChange(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  }

  async function handleDeleteSilent(id) {
    try {
      await deleteContact(id);
      onContactsChange(prev => prev.filter(c => c.id !== id));
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
      onContactsChange(refreshed);
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
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--header-bg)' }}>
          <strong style={{ color: 'var(--gold-light)' }}>{displayed.length}</strong>
          {filter ? ` of ${contacts.length}` : ''} contacts
        </span>

        {dupGroups.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowDuplicates(true)}
            style={{ color: '#ffb450', borderColor: 'rgba(255,180,80,0.45)', fontWeight: 700 }}
          >
            ⚠ {dupGroups.length} duplicate{dupGroups.length !== 1 ? 's' : ''}
          </button>
        )}

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
          id="ct-search"
          name="search"
          type="search"
          placeholder="Filter by name, phone, email…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(139,180,225,0.3)',
            borderRadius: 8,
            color: 'var(--white)',
            fontSize: 16,
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

      <div className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        <table className="contacts-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {[
                { key: 'firstName', label: 'First Name', width: '18%' },
                { key: 'lastName',  label: 'Last Name',  width: '16%' },
                { key: 'lastSeen',  label: 'Last Seen',  width: '13%', className: 'col-last-seen' },
              ].map(({ key, label, width, className }) => (
                <th key={key} className={className} style={{ width, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => toggleSort(key)}>
                  {label}
                  <span style={{ marginLeft: 5, opacity: sortKey === key ? 1 : 0.3, fontSize: 11 }}>
                    {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                  </span>
                </th>
              ))}
              <th style={{ width: '22%' }}>Phone</th>
              <th className="col-email" style={{ width: '22%' }}>Email</th>
              {isUnlocked && <th style={{ width: 90, textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {contactsLoading ? (
              <tr><td colSpan={isUnlocked ? 6 : 5} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={isUnlocked ? 6 : 5} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
                {filter ? 'No contacts match your filter.' : 'No contacts yet — they are saved automatically when signing up anglers.'}
              </td></tr>
            ) : displayed.map(c => (
              <tr key={c.id}>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName}</td>
                <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastName}</td>
                <td className="col-last-seen" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--header-bg)' }}>
                  {formatLastSeen(c.lastSeen)}
                </td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.phone
                    ? <a href={`tel:${c.phone}`} style={{ color: 'var(--water-light)', textDecoration: 'none' }}>{formatPhone(c.phone)}</a>
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

      {showDuplicates && (
        <DuplicateReviewModal
          groups={dupGroups}
          onDelete={handleDeleteSilent}
          onClose={() => setShowDuplicates(false)}
        />
      )}
    </div>
  );
}
