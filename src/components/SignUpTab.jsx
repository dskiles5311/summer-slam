import { useState, useRef } from 'react';
import ContactSuggest from './ContactSuggest';

const EMPTY_FORM = {
  boaterFirst: '', boaterLast: '', boaterPhone: '',
  coAnglerFirst: '', coAnglerLast: '', coAnglerPhone: '',
  lunker: '', option: '', paid: '', appSigned: '',
  buyIn: '',
};

function Toggle({ label, value, onChange }) {
  const active = value === '1';
  return (
    <button
      type="button"
      onClick={() => onChange(active ? '0' : '1')}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
        minWidth: 72,
        background: active ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.07)',
        color: active ? '#4CAF50' : 'rgba(255,255,255,0.5)',
        fontWeight: active ? 700 : 400,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span style={{ fontSize: 18 }}>{active ? '✓' : '○'}</span>
      <span>{label}</span>
    </button>
  );
}

export default function SignUpTab({ onAddEntry }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [recentEntries, setRecentEntries] = useState([]);
  const boaterFirstRef = useRef(null);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.boaterFirst.trim()) errs.boaterFirst = 'Required';
    if (!form.boaterLast.trim())  errs.boaterLast  = 'Required';
    if (!form.boaterPhone.trim()) errs.boaterPhone  = 'Required';
    const hasCoAngler = form.coAnglerFirst.trim() || form.coAnglerLast.trim();
    if (hasCoAngler) {
      if (!form.coAnglerFirst.trim()) errs.coAnglerFirst = 'Required if co-angler specified';
      if (!form.coAnglerLast.trim())  errs.coAnglerLast  = 'Required if co-angler specified';
      if (!form.coAnglerPhone.trim()) errs.coAnglerPhone  = 'Required if co-angler specified';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const entry = {
      boaterFirst:   form.boaterFirst.trim(),
      boaterLast:    form.boaterLast.trim(),
      boaterPhone:   form.boaterPhone.trim(),
      coAnglerFirst: form.coAnglerFirst.trim(),
      coAnglerLast:  form.coAnglerLast.trim(),
      coAnglerPhone: form.coAnglerPhone.trim(),
      lunker:    form.lunker    === '' ? '' : parseInt(form.lunker),
      option:    form.option    === '' ? '' : parseInt(form.option),
      paid:      form.paid      === '' ? '' : parseInt(form.paid),
      appSigned: form.appSigned === '' ? '' : parseInt(form.appSigned),
      buyIn:     parseFloat(form.buyIn) || 0,
      boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
    };

    const success = await onAddEntry(entry);
    if (success) {
      setRecentEntries(prev => [entry, ...prev].slice(0, 10));
      setForm({ ...EMPTY_FORM });
      setErrors({});
      boaterFirstRef.current?.focus();
    }
  }

  const FIELD = { display: 'flex', flexDirection: 'column', gap: 4 };
  const LABEL = { fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase' };
  const ERR = { fontSize: 11, color: '#ff7070', marginTop: 2 };

  return (
    <div className="tab-panel active">
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 12px' }}>
        <form onSubmit={handleSubmit} noValidate>

          {/* Boater */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Boater
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={FIELD}>
                <label style={LABEL}>First Name *</label>
                <ContactSuggest
                  value={form.boaterFirst}
                  placeholder="First"
                  inputRef={boaterFirstRef}
                  onChange={v => set('boaterFirst', v)}
                  onSelect={c => setForm(prev => ({ ...prev, boaterFirst: c.firstName, boaterLast: c.lastName, boaterPhone: c.phone }))}
                />
                {errors.boaterFirst && <span style={ERR}>{errors.boaterFirst}</span>}
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Last Name *</label>
                <ContactSuggest
                  value={form.boaterLast}
                  placeholder="Last"
                  onChange={v => set('boaterLast', v)}
                  onSelect={c => setForm(prev => ({ ...prev, boaterFirst: c.firstName, boaterLast: c.lastName, boaterPhone: c.phone }))}
                />
                {errors.boaterLast && <span style={ERR}>{errors.boaterLast}</span>}
              </div>
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Phone *</label>
              <input type="tel" value={form.boaterPhone} placeholder="(555) 123-4567"
                     onChange={e => set('boaterPhone', e.target.value)} />
              {errors.boaterPhone && <span style={ERR}>{errors.boaterPhone}</span>}
            </div>
          </div>

          {/* Co-Angler */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Co-Angler <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={FIELD}>
                <label style={LABEL}>First Name</label>
                <ContactSuggest
                  value={form.coAnglerFirst}
                  placeholder="First"
                  onChange={v => set('coAnglerFirst', v)}
                  onSelect={c => setForm(prev => ({ ...prev, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerPhone: c.phone }))}
                />
                {errors.coAnglerFirst && <span style={ERR}>{errors.coAnglerFirst}</span>}
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Last Name</label>
                <ContactSuggest
                  value={form.coAnglerLast}
                  placeholder="Last"
                  onChange={v => set('coAnglerLast', v)}
                  onSelect={c => setForm(prev => ({ ...prev, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerPhone: c.phone }))}
                />
                {errors.coAnglerLast && <span style={ERR}>{errors.coAnglerLast}</span>}
              </div>
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Phone {(form.coAnglerFirst || form.coAnglerLast) ? '*' : ''}</label>
              <input type="tel" value={form.coAnglerPhone} placeholder="(555) 123-4567"
                     onChange={e => set('coAnglerPhone', e.target.value)} />
              {errors.coAnglerPhone && <span style={ERR}>{errors.coAnglerPhone}</span>}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Fees &amp; Status
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Toggle label="Lunker" value={form.lunker}    onChange={v => set('lunker', v)} />
              <Toggle label="Option" value={form.option}    onChange={v => set('option', v)} />
              <Toggle label="Paid"   value={form.paid}      onChange={v => set('paid', v)} />
              <Toggle label="App ✓"  value={form.appSigned} onChange={v => set('appSigned', v)} />
            </div>
            <div style={{ ...FIELD, maxWidth: 180 }}>
              <label style={LABEL}>Buy-In ($)</label>
              <input type="number" value={form.buyIn} placeholder="0.00" step="0.01" min="0"
                     inputMode="decimal" onChange={e => set('buyIn', e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn btn-gold"
                  style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, borderRadius: 10 }}>
            + Sign Up
          </button>
        </form>

        {/* Recent entries */}
        {recentEntries.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Recently Added
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentEntries.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)', fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600 }}>{e.boaterFirst} {e.boaterLast}</span>
                  {(e.coAnglerFirst || e.coAnglerLast) && (
                    <span style={{ opacity: 0.6 }}>/ {e.coAnglerFirst} {e.coAnglerLast}</span>
                  )}
                  <span style={{ opacity: 0.45, fontSize: 11 }}>
                    {[e.lunker === 1 && 'L', e.option === 1 && 'O', e.paid === 1 && 'P', e.appSigned === 1 && '✓'].filter(Boolean).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
