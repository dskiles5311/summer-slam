import { useState, useMemo, useRef, useEffect } from 'react';
import { formatPhone } from '../utils/phone';

function isOn(v) { return v === 1 || v === '1'; }

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(139,180,225,0.28)',
  borderRadius: 6,
  color: 'var(--white)',
  fontSize: 16,
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

const SECTION_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--gold-light)',
  textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4,
};

function F({ id, label, value, onChange, onBlur, type = 'text', inputMode }) {
  return (
    <div>
      <label htmlFor={id} style={LABEL_STYLE}>{label}</label>
      <input id={id} name={id} type={type} inputMode={inputMode} value={value}
        onChange={e => onChange(e.target.value)} onBlur={onBlur} style={INPUT_STYLE} />
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
      boaterFirst:   row.boaterFirst   || '',
      boaterLast:    row.boaterLast    || '',
      boaterPhone:   formatPhone(row.boaterPhone   || ''),
      boaterEmail:   row.boaterEmail   || '',
      coAnglerFirst: row.coAnglerFirst || '',
      coAnglerLast:  row.coAnglerLast  || '',
      coAnglerPhone: formatPhone(row.coAnglerPhone || ''),
      coAnglerEmail: row.coAnglerEmail || '',
      boatNo:    row.boatNo    || '',
      lunker:    row.lunker    ?? '',
      option:    row.option    ?? '',
      appSigned: row.appSigned ?? '',
    });
  }

  function set(field, val) { setDraft(d => ({ ...d, [field]: val })); }
  function toggle(field)   { setDraft(d => ({ ...d, [field]: isOn(d[field]) ? 0 : 1 })); }
  function swapAnglers()   {
    setDraft(d => ({
      ...d,
      boaterFirst:   d.coAnglerFirst,  coAnglerFirst: d.boaterFirst,
      boaterLast:    d.coAnglerLast,   coAnglerLast:  d.boaterLast,
      boaterPhone:   d.coAnglerPhone,  coAnglerPhone: d.boaterPhone,
      boaterEmail:   d.coAnglerEmail,  coAnglerEmail: d.boaterEmail,
    }));
  }

  async function handleSave(row) {
    setSaving(true);
    try { await onSave(row.id, draft); setExpandedId(null); setDraft({}); }
    finally { setSaving(false); }
  }

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>✅ Check In</h2>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 12, borderBottom: '1px solid rgba(168,200,160,0.13)' }}>
        <input
          ref={searchRef}
          id="ci-search"
          name="search"
          type="search"
          placeholder="Search by name, phone, or boat #…"
          value={query}
          onChange={e => { setQuery(e.target.value); setExpandedId(null); setDraft({}); }}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(139,180,225,0.35)',
            borderRadius: 8, color: 'var(--white)',
            fontSize: 16, padding: '10px 13px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{
        maxWidth: 560, margin: '0 auto', paddingTop: 12,
        overflowY: 'auto',
        maxHeight: 'max(200px, calc(100dvh - 330px))',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
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
            const appNotSigned = !isOn(row.appSigned);
            return (
              <div key={row.id} style={{
                borderRadius: 8,
                border: `1.5px solid ${isOpen ? 'rgba(139,180,225,0.4)' : appNotSigned ? 'rgba(255,107,107,0.3)' : 'rgba(168,200,160,0.18)'}`,
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
                    {appNotSigned && (
                      <span style={{ fontSize: 10, background: 'rgba(255,107,107,0.2)', color: '#ff6b6b', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>!</span>
                    )}
                    {isOn(row.lunker) && <span style={{ fontSize: 10, background: 'rgba(232,200,118,0.2)', color: '#e8c876', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>L</span>}
                    {isOn(row.option) && <span style={{ fontSize: 10, background: 'rgba(120,200,255,0.2)', color: '#78c8ff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>O</span>}
                  </div>
                  <span style={{ color: 'var(--header-bg)', fontSize: 11, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded card */}
                {isOpen && (
                  <form onSubmit={e => { e.preventDefault(); handleSave(row); }}
                    style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(168,200,160,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* App not signed alert */}
                    {!isOn(draft.appSigned) && (
                      <div style={{
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.4)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 12, color: '#ff9090', fontWeight: 700,
                      }}>
                        ⚠️ Application not signed — collect signature before weigh-in.
                      </div>
                    )}

                    {/* Boater */}
                    <div style={SECTION_LABEL}>Boater</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <F id="ci-boater-first" label="First" value={draft.boaterFirst} onChange={v => set('boaterFirst', v)} />
                      <F id="ci-boater-last"  label="Last"  value={draft.boaterLast}  onChange={v => set('boaterLast', v)} />
                      <F id="ci-boater-phone" label="Phone" type="tel" inputMode="tel"
                         value={draft.boaterPhone}
                         onChange={v => set('boaterPhone', v)}
                         onBlur={() => set('boaterPhone', formatPhone(draft.boaterPhone))} />
                      <F id="ci-boater-email" label="Email" type="email"
                         value={draft.boaterEmail}
                         onChange={v => set('boaterEmail', v)} />
                    </div>

                    {/* Swap button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(168,200,160,0.12)' }} />
                      <button type="button" onClick={swapAnglers} style={{
                        padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        border: '1px solid rgba(139,180,225,0.3)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--header-bg)',
                        whiteSpace: 'nowrap',
                      }}>
                        ⇅ Swap Boater / Co-Angler
                      </button>
                      <div style={{ flex: 1, height: 1, background: 'rgba(168,200,160,0.12)' }} />
                    </div>

                    {/* Co-Angler */}
                    <div style={{ ...SECTION_LABEL, marginTop: 2 }}>Co-Angler</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <F id="ci-co-first" label="First" value={draft.coAnglerFirst} onChange={v => set('coAnglerFirst', v)} />
                      <F id="ci-co-last"  label="Last"  value={draft.coAnglerLast}  onChange={v => set('coAnglerLast', v)} />
                      <F id="ci-co-phone" label="Phone" type="tel" inputMode="tel"
                         value={draft.coAnglerPhone}
                         onChange={v => set('coAnglerPhone', v)}
                         onBlur={() => set('coAnglerPhone', formatPhone(draft.coAnglerPhone))} />
                      <F id="ci-co-email" label="Email" type="email"
                         value={draft.coAnglerEmail}
                         onChange={v => set('coAnglerEmail', v)} />
                    </div>

                    {/* Boat #, Lunker, Option */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'end', marginTop: 6 }}>
                      <F id="ci-boat-no" label="Boat #" inputMode="numeric" value={draft.boatNo} onChange={v => set('boatNo', v)} />
                      <ToggleField label="Lunker" on={isOn(draft.lunker)} onToggle={() => toggle('lunker')} />
                      <ToggleField label="Option" on={isOn(draft.option)} onToggle={() => toggle('option')} />
                    </div>

                    {/* App Signed */}
                    <div>
                      <span style={LABEL_STYLE}>App Signed</span>
                      <button type="button" onClick={() => toggle('appSigned')} style={{
                        width: '100%', padding: '8px 0', borderRadius: 6,
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        border: `1.5px solid ${isOn(draft.appSigned) ? '#4CAF50' : '#ff6b6b'}`,
                        background: isOn(draft.appSigned) ? 'rgba(76,175,80,0.18)' : 'rgba(255,107,107,0.12)',
                        color: isOn(draft.appSigned) ? '#4CAF50' : '#ff9090',
                      }}>
                        {isOn(draft.appSigned) ? '✓ Signed' : '✕ Not Signed — tap to mark signed'}
                      </button>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setExpandedId(null); setDraft({}); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
