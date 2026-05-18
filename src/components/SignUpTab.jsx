import { useState, useRef } from 'react';
import ContactSuggest from './ContactSuggest';
import EmailInput from './EmailInput';
import { formatPhone } from '../utils/phone';
import { evalMath } from '../utils/evalMath';

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

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];
const SUFFIX_STYLE = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8, color: 'var(--white)', fontSize: 16, padding: '10px 12px',
  width: '100%', boxSizing: 'border-box', outline: 'none', cursor: 'pointer', minHeight: 44,
};

const EMPTY = {
  boaterFirst: '', boaterLast: '', boaterSuffix: '', boaterPhone: '', boaterEmail: '',
  coAnglerFirst: '', coAnglerLast: '', coAnglerSuffix: '', coAnglerPhone: '', coAnglerEmail: '',
  lunker: '', option: '', paid: '', appSigned: '', buyIn: '',
};

function ToggleButton({ value, onChange }) {
  const isYes = value === 1 || value === '1';
  const isNo  = value === 0 || value === '0';
  function next() {
    if (isYes) onChange(0);
    else if (isNo) onChange('');
    else onChange(1);
  }
  return (
    <button
      type="button"
      onClick={next}
      style={{
        width: '100%', minHeight: 44, boxSizing: 'border-box',
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        fontSize: 15, fontWeight: 700,
        border: `1px solid ${isYes ? 'rgba(76,175,80,0.5)' : isNo ? 'rgba(255,107,107,0.5)' : 'rgba(139,180,225,0.3)'}`,
        background: isYes ? 'rgba(76,175,80,0.15)' : isNo ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.06)',
        color: isYes ? '#4CAF50' : isNo ? '#ff6b6b' : 'var(--header-bg)',
      }}
    >
      {isYes ? '✓ Yes' : isNo ? '✗ No' : '—'}
    </button>
  );
}

export default function SignUpTab({ onAddEntry, settings }) {
  const entryFee = parseFloat(settings?.fees?.entryFee) || 249;
  const [form, setForm]         = useState({ ...EMPTY });
  const [errors, setErrors]     = useState({});
  const [recent, setRecent]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const boaterFirstRef      = useRef(null);
  const boaterContactIdRef  = useRef(null);
  const coAnglerContactIdRef = useRef(null);

  function set(field, val) {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'buyIn') {
        const amount = parseFloat(evalMath(String(val)));
        if (!isNaN(amount) && amount > 0) {
          next.paid = amount >= entryFee ? 1 : 0;
        }
      }
      return next;
    });
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
    if (String(form.buyIn).trim() && isNaN(evalMath(form.buyIn))) errs.buyIn = 'Invalid expression';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const entry = {
      boaterFirst:    form.boaterFirst.trim(),
      boaterLast:     form.boaterLast.trim(),
      boaterSuffix:   form.boaterSuffix,
      boaterPhone:    form.boaterPhone.trim(),
      boaterEmail:    form.boaterEmail.trim(),
      coAnglerFirst:  form.coAnglerFirst.trim(),
      coAnglerLast:   form.coAnglerLast.trim(),
      coAnglerSuffix: form.coAnglerSuffix,
      coAnglerPhone:  form.coAnglerPhone.trim(),
      coAnglerEmail:  form.coAnglerEmail.trim(),
      lunker:    form.lunker    === '' ? '' : parseInt(form.lunker),
      option:    form.option    === '' ? '' : parseInt(form.option),
      paid:      form.paid      === '' ? '' : parseInt(form.paid),
      appSigned: form.appSigned === '' ? '' : parseInt(form.appSigned),
      buyIn:     parseFloat((evalMath(form.buyIn) || 0).toFixed(2)),
      boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
      boaterContactId:   boaterContactIdRef.current  ?? null,
      coAnglerContactId: coAnglerContactIdRef.current ?? null,
    };

    setSubmitting(true);
    const ok = await onAddEntry(entry);
    setSubmitting(false);

    if (ok) {
      setRecent(prev => [entry, ...prev].slice(0, 10));
      setForm({ ...EMPTY });
      setErrors({});
      boaterContactIdRef.current  = null;
      coAnglerContactIdRef.current = null;
      setTimeout(() => boaterFirstRef.current?.focus(), 0);
    }
  }

  function handleClear() {
    setForm({ ...EMPTY });
    setErrors({});
    boaterContactIdRef.current  = null;
    coAnglerContactIdRef.current = null;
    setTimeout(() => boaterFirstRef.current?.focus(), 0);
  }

  const err = (field) => errors[field]
    ? <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors[field]}</div>
    : null;

  const fieldBorder = (field) => errors[field]
    ? { ...FIELD, borderColor: '#ff6b6b' }
    : FIELD;

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>📝 Sign Up</h2>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>

        {/* ── Boater ── */}
        <div>
          <div style={SECTION}>Boater</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <div>
              <label htmlFor="su-boater-first" style={LABEL}>First Name *</label>
              <input ref={boaterFirstRef} id="su-boater-first" name="boaterFirst" type="text" value={form.boaterFirst} placeholder="First"
                     onChange={e => { boaterContactIdRef.current = null; set('boaterFirst', e.target.value); }}
                     style={fieldBorder('boaterFirst')} />
              {err('boaterFirst')}
            </div>
            <div>
              <label htmlFor="su-boater-last" style={LABEL}>Last Name *</label>
              <ContactSuggest
                value={form.boaterLast}
                placeholder="Last"
                onChange={v => { boaterContactIdRef.current = null; set('boaterLast', v); }}
                onSelect={c => { boaterContactIdRef.current = c.id; setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterSuffix: c.suffix || '', boaterPhone: c.phone, boaterEmail: c.email || p.boaterEmail })); }}
                inputProps={{ id: 'su-boater-last', name: 'boaterLast', style: fieldBorder('boaterLast') }}
              />
              {err('boaterLast')}
            </div>
            <div>
              <label style={LABEL}>Suffix</label>
              <select value={form.boaterSuffix} onChange={e => set('boaterSuffix', e.target.value)} style={SUFFIX_STYLE}>
                {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="su-boater-email" style={LABEL}>Email</label>
            <EmailInput id="su-boater-email" name="boaterEmail" value={form.boaterEmail} onChange={v => set('boaterEmail', v)} style={FIELD} />
          </div>
          <div>
            <label htmlFor="su-boater-phone" style={LABEL}>Phone *</label>
            <ContactSuggest
              value={form.boaterPhone}
              placeholder="555-123-4567"
              onChange={v => set('boaterPhone', v)}
              onSelect={c => { boaterContactIdRef.current = c.id; setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterSuffix: c.suffix || '', boaterPhone: c.phone, boaterEmail: c.email || p.boaterEmail })); }}
              onBlur={e => set('boaterPhone', formatPhone(e.target.value))}
              inputProps={{ id: 'su-boater-phone', name: 'boaterPhone', style: fieldBorder('boaterPhone'), type: 'tel' }}
            />
            {err('boaterPhone')}
          </div>
        </div>

        {/* ── Co-Angler ── */}
        <div>
          <div style={SECTION}>
            Co-Angler{' '}
            <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <div>
              <label htmlFor="su-co-first" style={LABEL}>First Name</label>
              <input id="su-co-first" name="coAnglerFirst" type="text" value={form.coAnglerFirst} placeholder="First"
                     onChange={e => { coAnglerContactIdRef.current = null; set('coAnglerFirst', e.target.value); }}
                     style={fieldBorder('coAnglerFirst')} />
              {err('coAnglerFirst')}
            </div>
            <div>
              <label htmlFor="su-co-last" style={LABEL}>Last Name</label>
              <ContactSuggest
                value={form.coAnglerLast}
                placeholder="Last"
                onChange={v => { coAnglerContactIdRef.current = null; set('coAnglerLast', v); }}
                onSelect={c => { coAnglerContactIdRef.current = c.id; setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerSuffix: c.suffix || '', coAnglerPhone: c.phone, coAnglerEmail: c.email || p.coAnglerEmail })); }}
                inputProps={{ id: 'su-co-last', name: 'coAnglerLast', style: fieldBorder('coAnglerLast') }}
              />
              {err('coAnglerLast')}
            </div>
            <div>
              <label style={LABEL}>Suffix</label>
              <select value={form.coAnglerSuffix} onChange={e => set('coAnglerSuffix', e.target.value)} style={SUFFIX_STYLE}>
                {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="su-co-email" style={LABEL}>Email</label>
            <EmailInput id="su-co-email" name="coAnglerEmail" value={form.coAnglerEmail} onChange={v => set('coAnglerEmail', v)} style={FIELD} />
          </div>
          <div>
            <label htmlFor="su-co-phone" style={LABEL}>
              Phone{(form.coAnglerFirst || form.coAnglerLast) ? ' *' : ''}
            </label>
            <ContactSuggest
              value={form.coAnglerPhone}
              placeholder="555-123-4567"
              onChange={v => set('coAnglerPhone', v)}
              onSelect={c => { coAnglerContactIdRef.current = c.id; setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerSuffix: c.suffix || '', coAnglerPhone: c.phone, coAnglerEmail: c.email || p.coAnglerEmail })); }}
              onBlur={e => set('coAnglerPhone', formatPhone(e.target.value))}
              inputProps={{ id: 'su-co-phone', name: 'coAnglerPhone', style: fieldBorder('coAnglerPhone'), type: 'tel' }}
            />
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
                <span style={LABEL}>{label}</span>
                <ToggleButton value={form[key]} onChange={v => set(key, v)} />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="su-buy-in" style={LABEL}>Amount ($)</label>
            <input id="su-buy-in" name="buyIn" type="text" inputMode="decimal" value={form.buyIn} placeholder="0.00"
                   onChange={e => set('buyIn', e.target.value)}
                   onBlur={e => {
                     const result = evalMath(e.target.value);
                     if (!isNaN(result)) set('buyIn', parseFloat(result.toFixed(2)));
                   }}
                   style={fieldBorder('buyIn')} />
            {err('buyIn')}
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

      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(139,180,225,0.07)', border: '1px solid rgba(139,180,225,0.2)', fontSize: 12, color: 'var(--header-bg)', lineHeight: 1.6 }}>
        💡 <strong style={{ color: 'var(--white)' }}>Correcting a name?</strong> If an angler's name autofills from a saved contact and needs to be corrected, go to the <strong style={{ color: 'var(--white)' }}>Contacts tab</strong> and use the ✏️ Edit button to update the contact there.
      </div>

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
                  {[r.boaterFirst, r.boaterLast, r.boaterSuffix].filter(Boolean).join(' ')}
                </span>
                {(r.coAnglerFirst || r.coAnglerLast) && (
                  <span style={{ flex: 1, color: 'var(--header-bg)', marginLeft: 8 }}>
                    / {[r.coAnglerFirst, r.coAnglerLast, r.coAnglerSuffix].filter(Boolean).join(' ')}
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
    </div>
  );
}
