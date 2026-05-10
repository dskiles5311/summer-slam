import { useState, useMemo, useRef, useEffect } from 'react';

function isOn(v) { return v === 1 || v === '1'; }

function ToggleBtn({ label, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: 8,
        border: `2px solid ${on ? '#4CAF50' : 'rgba(168,200,160,0.35)'}`,
        background: on ? 'rgba(76,175,80,0.18)' : 'rgba(255,255,255,0.04)',
        color: on ? '#4CAF50' : 'var(--header-bg)',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        minWidth: 64,
        transition: 'all 0.15s',
      }}
    >
      {on ? 'YES' : 'NO'}
    </button>
  );
}

function Field({ label, value, onChange, type = 'text', inputMode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(139,180,225,0.3)',
          borderRadius: 8,
          color: 'var(--white)',
          fontSize: 16,
          padding: '10px 12px',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          minHeight: 44,
        }}
      />
    </div>
  );
}

export default function CheckInTab({ entries, onSave }) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return entries.filter(e => {
      const name = `${e.boaterFirst} ${e.boaterLast} ${e.coAnglerFirst} ${e.coAnglerLast}`.toLowerCase();
      const bPhone = (e.boaterPhone || '').replace(/\D/g, '');
      const cPhone = (e.coAnglerPhone || '').replace(/\D/g, '');
      const boat = String(e.boatNo || '').toLowerCase();
      return name.includes(q)
        || boat.includes(q)
        || (digits && bPhone.includes(digits))
        || (digits && cPhone.includes(digits));
    });
  }, [entries, query]);

  function openCard(row) {
    if (expandedId === row.id) {
      setExpandedId(null);
      setDraft({});
      return;
    }
    setExpandedId(row.id);
    setDraft({
      boaterFirst:   row.boaterFirst   || '',
      boaterLast:    row.boaterLast    || '',
      boaterPhone:   row.boaterPhone   || '',
      coAnglerFirst: row.coAnglerFirst || '',
      coAnglerLast:  row.coAnglerLast  || '',
      coAnglerPhone: row.coAnglerPhone || '',
      boatNo:        row.boatNo        || '',
      lunker:        row.lunker        ?? '',
      option:        row.option        ?? '',
    });
  }

  function set(field, val) {
    setDraft(d => ({ ...d, [field]: val }));
  }

  function toggleFlag(field) {
    setDraft(d => ({ ...d, [field]: isOn(d[field]) ? 0 : 1 }));
  }

  async function handleSave(row) {
    setSaving(true);
    try {
      await onSave(row.id, draft);
      setExpandedId(null);
      setDraft({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <span style={{ fontSize: 14, color: 'var(--header-bg)' }}>
          Search the roster to look up and update an angler's check-in info.
        </span>
      </div>

      <div style={{ padding: '0 0 12px 0' }}>
        <input
          ref={searchRef}
          type="search"
          placeholder="Name, phone number, or boat #…"
          value={query}
          onChange={e => { setQuery(e.target.value); setExpandedId(null); setDraft({}); }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(139,180,225,0.35)',
            borderRadius: 10,
            color: 'var(--white)',
            fontSize: 17,
            padding: '13px 16px',
            outline: 'none',
          }}
        />
      </div>

      {query.trim() && results.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--header-bg)', padding: '32px 0', fontSize: 15 }}>
          No entries match "{query.trim()}"
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(row => {
          const isOpen = expandedId === row.id;
          return (
            <div
              key={row.id}
              style={{
                borderRadius: 12,
                border: `1.5px solid ${isOpen ? 'rgba(139,180,225,0.45)' : 'rgba(168,200,160,0.18)'}`,
                background: isOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Row summary — tap to expand */}
              <div
                onClick={() => openCard(row)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  minWidth: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(139,180,225,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--gold-light)',
                }}>
                  {row.boatNo || '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.boaterFirst} {row.boaterLast}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--header-bg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.coAnglerFirst || row.coAnglerLast
                      ? `Co: ${row.coAnglerFirst} ${row.coAnglerLast}`
                      : 'No co-angler'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {isOn(row.lunker) && (
                    <span style={{ fontSize: 11, background: 'rgba(232,200,118,0.2)', color: '#e8c876', borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>L</span>
                  )}
                  {isOn(row.option) && (
                    <span style={{ fontSize: 11, background: 'rgba(120,200,255,0.2)', color: '#78c8ff', borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>O</span>
                  )}
                </div>
                <div style={{ color: 'var(--header-bg)', fontSize: 18, flexShrink: 0 }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded contact card */}
              {isOpen && (
                <div style={{ padding: '0 16px 18px', borderTop: '1px solid rgba(168,200,160,0.15)' }}>
                  <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Boater section */}
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold-light)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: -6 }}>
                      Boater
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="First Name" value={draft.boaterFirst} onChange={v => set('boaterFirst', v)} />
                      <Field label="Last Name"  value={draft.boaterLast}  onChange={v => set('boaterLast', v)} />
                    </div>
                    <Field label="Phone" value={draft.boaterPhone} onChange={v => set('boaterPhone', v)} type="tel" inputMode="tel" />

                    {/* Co-Angler section */}
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#78c8ff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: -6 }}>
                      Co-Angler
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="First Name" value={draft.coAnglerFirst} onChange={v => set('coAnglerFirst', v)} />
                      <Field label="Last Name"  value={draft.coAnglerLast}  onChange={v => set('coAnglerLast', v)} />
                    </div>
                    <Field label="Phone" value={draft.coAnglerPhone} onChange={v => set('coAnglerPhone', v)} type="tel" inputMode="tel" />

                    {/* Boat # */}
                    <Field label="Boat #" value={draft.boatNo} onChange={v => set('boatNo', v)} inputMode="numeric" />

                    {/* Lunker / Option toggles */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Lunker</span>
                        <ToggleBtn on={isOn(draft.lunker)} onClick={() => toggleFlag('lunker')} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Option</span>
                        <ToggleBtn on={isOn(draft.option)} onClick={() => toggleFlag('option')} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, minHeight: 48, fontSize: 16 }}
                        disabled={saving}
                        onClick={() => handleSave(row)}
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ minHeight: 48, fontSize: 16 }}
                        onClick={() => { setExpandedId(null); setDraft({}); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
