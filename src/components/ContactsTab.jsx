import { useState, useEffect, useRef } from 'react';

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
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [editing, setEditing]   = useState(null);
  const [sortKey, setSortKey]   = useState(() => localStorage.getItem('ss_contacts_sort_key') || 'lastName');
  const [sortDir, setSortDir]   = useState(() => localStorage.getItem('ss_contacts_sort_dir') || 'asc');

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

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--header-bg)' }}>
          <strong style={{ color: 'var(--gold-light)' }}>{displayed.length}</strong>
          {filter ? ` of ${contacts.length}` : ''} contacts
        </span>
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
            width: 260,
            outline: 'none',
          }}
        />
      </div>

      <div className="table-wrapper">
        <table style={{ tableLayout: 'fixed' }}>
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
              <th style={{ width: '22%' }}>Phone</th>
              <th style={{ width: '28%' }}>Email</th>
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
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.email
                    ? <a href={`mailto:${c.email}`} style={{ color: 'var(--water-light)', textDecoration: 'none' }}>{c.email}</a>
                    : <span style={{ color: 'var(--header-bg)' }}>—</span>}
                </td>
                {isUnlocked && (
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: '3px 8px', fontSize: 12, marginRight: 4 }}
                      onClick={() => setEditing(c)}
                    >✏️</button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.4)', padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}
                    >✕</button>
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
