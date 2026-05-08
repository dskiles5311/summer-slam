import { useState, useRef } from 'react';
import ContactSuggest from './ContactSuggest';

const FIELD = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 16,
  padding: '10px 14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  minHeight: 44,
};

const LABEL = {
  fontSize: 12, fontWeight: 700, color: 'var(--header-bg)',
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 5, display: 'block',
};

const SECTION = {
  fontSize: 13, fontWeight: 700, color: 'var(--gold-light)',
  textTransform: 'uppercase', letterSpacing: 1,
  marginBottom: 10, paddingBottom: 6,
  borderBottom: '1px solid rgba(168,200,160,0.25)',
};

const EMPTY = {
  boaterFirst: '', boaterLast: '', boaterPhone: '',
  coAnglerFirst: '', coAnglerLast: '', coAnglerPhone: '',
  lunker: '', option: '', paid: '', appSigned: '', buyIn: '',
};

export default function SignUpTab({ onAddEntry }) {
  const [form, setForm]         = useState({ ...EMPTY });
  const [errors, setErrors]     = useState({});
  const [recent, setRecent]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
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
      if (!form.coAnglerFirst.trim()) errs.coAnglerFirst = 'Required';
      if (!form.coAnglerLast.trim())  errs.coAnglerLast  = 'Required';
      if (!form.coAnglerPhone.trim()) errs.coAnglerPhone  = 'Required';
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

    setSubmitting(true);
    const ok = await onAddEntry(entry);
    setSubmitting(false);

    if (ok) {
      setRecent(prev => [entry, ...prev].slice(0, 10));
      setForm({ ...EMPTY });
      setErrors({});
      boaterFirstRef.current?.focus();
    }
  }

  function handleClear() {
    setForm({ ...EMPTY });
    setErrors({});
    boaterFirstRef.current?.focus();
  }

  const err = (field) => errors[field]
    ? <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors[field]}</div>
    : null;

  const fieldBorder = (field) => errors[field]
    ? { ...FIELD, borderColor: '#ff6b6b' }
    : FIELD;

  return (
    <div className="tab-panel active" style={{ maxWidth: 520, margin: '0 auto', padding: '8px 0' }}>
      <h2 style={{ color: 'var(--gold-light)', fontSize: 18, marginBottom: 20, fontWeight: 800 }}>📝 Sign Up</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>

        {/* ── Boater ── */}
        <div>
          <div style={SECTION}>Boater</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={LABEL}>First Name *</label>
              <ContactSuggest
                value={form.boaterFirst}
                placeholder="First"
                inputRef={boaterFirstRef}
                onChange={v => set('boaterFirst', v)}
                onSelect={c => setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterPhone: c.phone }))}
                inputProps={{ style: fieldBorder('boaterFirst') }}
              />
              {err('boaterFirst')}
            </div>
            <div>
              <label style={LABEL}>Last Name *</label>
              <ContactSuggest
                value={form.boaterLast}
                placeholder="Last"
                onChange={v => set('boaterLast', v)}
                onSelect={c => setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterPhone: c.phone }))}
                inputProps={{ style: fieldBorder('boaterLast') }}
              />
              {err('boaterLast')}
            </div>
          </div>
          <div>
            <label style={LABEL}>Phone *</label>
            <input type="tel" value={form.boaterPhone} placeholder="(555) 123-4567"
                   onChange={e => set('boaterPhone', e.target.value)}
                   style={fieldBorder('boaterPhone')} />
            {err('boaterPhone')}
          </div>
        </div>

        {/* ── Co-Angler ── */}
        <div>
          <div style={SECTION}>
            Co-Angler{' '}
            <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={LABEL}>First Name</label>
              <ContactSuggest
                value={form.coAnglerFirst}
                placeholder="First"
                onChange={v => set('coAnglerFirst', v)}
                onSelect={c => setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerPhone: c.phone }))}
                inputProps={{ style: fieldBorder('coAnglerFirst') }}
              />
              {err('coAnglerFirst')}
            </div>
            <div>
              <label style={LABEL}>Last Name</label>
              <ContactSuggest
                value={form.coAnglerLast}
                placeholder="Last"
                onChange={v => set('coAnglerLast', v)}
                onSelect={c => setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerPhone: c.phone }))}
                inputProps={{ style: fieldBorder('coAnglerLast') }}
              />
              {err('coAnglerLast')}
            </div>
          </div>
          <div>
            <label style={LABEL}>
              Phone{(form.coAnglerFirst || form.coAnglerLast) ? ' *' : ''}
            </label>
            <input type="tel" value={form.coAnglerPhone} placeholder="(555) 123-4567"
                   onChange={e => set('coAnglerPhone', e.target.value)}
                   style={fieldBorder('coAnglerPhone')} />
            {err('coAnglerPhone')}
          </div>
        </div>

        {/* ── Buy-In Amount ── */}
        <div>
          <div style={SECTION}>Buy-In Amount</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { key: 'lunker',    label: 'Lunker'    },
              { key: 'option',    label: 'Option'    },
              { key: 'paid',      label: 'Paid'      },
              { key: 'appSigned', label: 'App Signed' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={LABEL}>{label}</label>
                <select
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  style={{ ...FIELD, fontSize: 14, WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">—</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            ))}
          </div>
          <div>
            <label style={LABEL}>Amount ($)</label>
            <input type="number" value={form.buyIn} placeholder="0.00" step="0.01" min="0"
                   inputMode="decimal" onChange={e => set('buyIn', e.target.value)}
                   style={FIELD} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-gold" disabled={submitting}
                  style={{ flex: 1, fontSize: 16, padding: '12px 0' }}>
            {submitting ? 'Saving…' : '+ Sign Up'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handleClear}
                  style={{ padding: '12px 20px' }}>
            Clear
          </button>
        </div>
      </form>

      {/* ── Recently Signed Up ── */}
      {recent.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ color: 'var(--header-bg)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Recently Signed Up
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13,
              }}>
                <span style={{ fontWeight: 700, color: 'var(--white)' }}>
                  {r.boaterFirst} {r.boaterLast}
                </span>
                {(r.coAnglerFirst || r.coAnglerLast) && (
                  <span style={{ flex: 1, color: 'var(--header-bg)', marginLeft: 8 }}>
                    / {r.coAnglerFirst} {r.coAnglerLast}
                  </span>
                )}
                <span style={{ color: 'var(--gold-light)', fontSize: 12, marginLeft: 8, whiteSpace: 'nowrap' }}>
                  {[
                    r.lunker    === 1 && 'L',
                    r.option    === 1 && 'O',
                    r.paid      === 1 && 'P',
                    r.appSigned === 1 && '✓',
                  ].filter(Boolean).join(' · ')}
                  {r.buyIn > 0 ? `  $${parseFloat(r.buyIn).toFixed(2)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
