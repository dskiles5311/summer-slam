import { useState, useMemo, useRef, useEffect } from 'react';

function isOn(v) { return v === 1 || v === '1'; }

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(139,180,225,0.28)',
  borderRadius: 6,
  color: 'var(--white)',
  fontSize: 13,
  padding: '6px 9px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--header-bg)',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 3,
};

function F({ label, value, onChange, type = 'text', inputMode }) {
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <input type={type} inputMode={inputMode} value={value}
        onChange={e => onChange(e.target.value)} style={INPUT_STYLE} />
    </div>
  );
}

function ToggleField({ label, on, onToggle }) {
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <button type="button" onClick={onToggle} style={{
        width: '100%', padding: '6px 0', borderRadius: 6,
        fontWeight: 700, fontSize: 13, cursor: 'pointer',
        border: `1.5px solid ${on ? '#4CAF50' : 'rgba(168,200,160,0.3)'}`,
        background: on ? 'rgba(76,175,80,0.18)' : 'rgba(255,255,255,0.04)',
        color: on ? '#4CAF50' : 'var(--header-bg)',
      }}>
        {on ? 'YES' : 'NO'}
      </button>
    </div>
  );
}

export default function CheckInTab({ entries, onSave }) {
  const [query, setQuery]           = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft]           = useState({});
  const [saving, setSaving]         = useState(false);
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
      return name.includes(q)
        || String(e.boatNo || '').includes(q)
        || (digits && (bPhone.includes(digits) || cPhone.includes(digits)));
    });
  }, [entries, query]);

  function openCard(row) {
    if (expandedId === row.id) { setExpandedId(null); setDraft({}); return; }
    setExpandedId(row.id);
    setDraft({
      boaterFirst: row.boaterFirst || '', boaterLast: row.boaterLast || '',
      boaterPhone: row.boaterPhone || '',
      coAnglerFirst: row.coAnglerFirst || '', coAnglerLast: row.coAnglerLast || '',
      coAnglerPhone: row.coAnglerPhone || '',
      boatNo: row.boatNo || '',
      lunker: row.lunker ?? '', option: row.option ?? '',
    });
  }

  function set(field, val) { setDraft(d => ({ ...d, [field]: val })); }
  function toggle(field)   { setDraft(d => ({ ...d, [field]: isOn(d[field]) ? 0 : 1 })); }

  async function handleSave(row) {
    setSaving(true);
    try { await onSave(row.id, draft); setExpandedId(null); setDraft({}); }
    finally { setSaving(false); }
  }

  return (
    <div className="tab-panel active">
      {/* Sticky search header — centered column width only, no full-bleed */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--navy)',
          borderBottom: '1px solid rgba(168,200,160,0.13)',
          paddingBottom: 12,
        }}>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search by name, phone, or boat #…"
            value={query}
            onChange={e => { setQuery(e.target.value); setExpandedId(null); setDraft({}); }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(139,180,225,0.35)',
              borderRadius: 8, color: 'var(--white)',
              fontSize: 15, padding: '10px 13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Scrollable results column — centered, bounded height */}
      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        paddingTop: 12,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 280px)',
      }}>
        {query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--header-bg)', padding: '24px 0', fontSize: 14 }}>
            No entries match "{query.trim()}"
          </div>
        )}

        {!query.trim() && (
          <div style={{ textAlign: 'center', color: 'var(--header-bg)', padding: '32px 0', fontSize: 14 }}>
            Search by name, phone number, or boat # to look up an angler.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(row => {
            const isOpen = expandedId === row.id;
            return (
              <div key={row.id} style={{
                borderRadius: 8,
                border: `1.5px solid ${isOpen ? 'rgba(139,180,225,0.4)' : 'rgba(168,200,160,0.18)'}`,
                background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                overflow: 'hidden',
              }}>
                {/* Summary row */}
                <div onClick={() => openCard(row)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', cursor: 'pointer', userSelect: 'none',
                }}>
                  <div style={{
                    minWidth: 36, height: 36, borderRadius: 7,
                    background: 'rgba(139,180,225,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 15, color: 'var(--gold-light)', flexShrink: 0,
                  }}>
                    {row.boatNo || '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.boaterFirst} {row.boaterLast}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--header-bg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.coAnglerFirst || row.coAnglerLast
                        ? `${row.coAnglerFirst} ${row.coAnglerLast}`.trim()
                        : 'No co-angler'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {isOn(row.lunker) && <span style={{ fontSize: 10, background: 'rgba(232,200,118,0.2)', color: '#e8c876', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>L</span>}
                    {isOn(row.option) && <span style={{ fontSize: 10, background: 'rgba(120,200,255,0.2)', color: '#78c8ff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>O</span>}
                  </div>
                  <span style={{ color: 'var(--header-bg)', fontSize: 11, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded card */}
                {isOpen && (
                  <div style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(168,200,160,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <F label="Boater First" value={draft.boaterFirst} onChange={v => set('boaterFirst', v)} />
                      <F label="Last"         value={draft.boaterLast}  onChange={v => set('boaterLast', v)} />
                      <F label="Phone" type="tel" inputMode="tel" value={draft.boaterPhone} onChange={v => set('boaterPhone', v)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <F label="Co-Angler First" value={draft.coAnglerFirst} onChange={v => set('coAnglerFirst', v)} />
                      <F label="Last"            value={draft.coAnglerLast}  onChange={v => set('coAnglerLast', v)} />
                      <F label="Phone" type="tel" inputMode="tel" value={draft.coAnglerPhone} onChange={v => set('coAnglerPhone', v)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'end' }}>
                      <F label="Boat #" inputMode="numeric" value={draft.boatNo} onChange={v => set('boatNo', v)} />
                      <ToggleField label="Lunker" on={isOn(draft.lunker)} onToggle={() => toggle('lunker')} />
                      <ToggleField label="Option" on={isOn(draft.option)} onToggle={() => toggle('option')} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={saving} onClick={() => handleSave(row)}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setExpandedId(null); setDraft({}); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
