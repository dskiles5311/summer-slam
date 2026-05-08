import { useState, useEffect, useRef } from 'react';

export default function ContactsTab({ isUnlocked, fetchContacts, updateContact, deleteContact }) {
  const [contacts, setContacts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('');
  const [editing, setEditing]     = useState(null); // { id, field, value }
  const [saving, setSaving]       = useState(false);
  const editRef = useRef(null);

  useEffect(() => {
    fetchContacts().then(data => { setContacts(data); setLoading(false); });
  }, [fetchContacts]);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const displayed = contacts.filter(c => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(q);
  });

  function startEdit(id, field, value) {
    if (!isUnlocked) return;
    setEditing({ id, field, value });
  }

  async function commitEdit() {
    if (!editing || saving) return;
    const { id, field, value } = editing;
    const contact = contacts.find(c => c.id === id);
    setSaving(true);
    try {
      const updated = await updateContact(id, {
        phone: field === 'phone' ? value : contact.phone,
        email: field === 'email' ? value : contact.email,
      });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setEditing(null);
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from contacts?`)) return;
    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  }

  function EditableCell({ contactId, field, value }) {
    const isActive = editing?.id === contactId && editing?.field === field;
    if (isActive) {
      return (
        <input
          ref={editRef}
          type={field === 'email' ? 'email' : 'tel'}
          value={editing.value}
          onChange={e => setEditing(prev => ({ ...prev, value: e.target.value }))}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--gold)',
            borderRadius: 6,
            color: 'var(--white)',
            fontSize: 13,
            padding: '4px 8px',
            width: '100%',
            outline: 'none',
          }}
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(contactId, field, value)}
        title={isUnlocked ? `Click to edit ${field}` : undefined}
        style={{
          cursor: isUnlocked ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: 4,
          display: 'inline-block',
          minWidth: 40,
          color: value ? 'var(--white)' : 'var(--header-bg)',
          borderBottom: isUnlocked ? '1px dashed rgba(168,200,160,0.35)' : 'none',
        }}
      >
        {value || (isUnlocked ? '—' : '—')}
      </span>
    );
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

      {!isUnlocked && (
        <div style={{ background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)', borderRadius: 8, padding: '10px 16px', margin: '0 0 16px 0', fontSize: 13, color: 'rgba(255,180,80,0.9)' }}>
          🔒 Unlock to edit contacts.
        </div>
      )}

      <div className="table-wrapper">
        <table style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Last Name</th>
              <th style={{ width: '20%' }}>First Name</th>
              <th style={{ width: '22%' }}>Phone</th>
              <th style={{ width: '28%' }}>Email</th>
              {isUnlocked && <th style={{ width: 60, textAlign: 'center' }}></th>}
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
                <td style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastName}</td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName}</td>
                <td><EditableCell contactId={c.id} field="phone" value={c.phone} /></td>
                <td style={{ overflow: 'hidden' }}><EditableCell contactId={c.id} field="email" value={c.email} /></td>
                {isUnlocked && (
                  <td style={{ textAlign: 'center' }}>
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
    </div>
  );
}
