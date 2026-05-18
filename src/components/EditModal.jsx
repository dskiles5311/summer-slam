import { useState, useEffect, useRef } from 'react';
import ContactSuggest from './ContactSuggest';
import EmailInput from './EmailInput';
import { formatPhone } from '../utils/phone';
import { evalMath } from '../utils/evalMath';

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];
const SUFFIX_STYLE = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8, color: 'var(--white)', fontSize: 14, padding: '9px 10px',
  width: '100%', boxSizing: 'border-box', outline: 'none', cursor: 'pointer',
};

const EMPTY = {
  boaterFirst: '', boaterLast: '', boaterSuffix: '', boaterPhone: '', boaterEmail: '',
  coAnglerFirst: '', coAnglerLast: '', coAnglerSuffix: '', coAnglerPhone: '', coAnglerEmail: '',
  boatNo: '', numFish: '', lunkerWeight: '', totalWeight: '',
  lunker: '', option: '', paid: '', appSigned: '', buyIn: '',
  needsAttention: false,
  rawWeight: null, deadFish: 0, shortFish: 0,
  offWaterAt: '',
};

function toDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toSqliteUtc(v) {
  if (!v) return '';
  const d = new Date(v); // datetime-local value is local time
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

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
        width: '100%', boxSizing: 'border-box',
        padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
        fontSize: 14, fontWeight: 700,
        border: `1px solid ${isYes ? 'rgba(76,175,80,0.5)' : isNo ? 'rgba(255,107,107,0.5)' : 'rgba(139,180,225,0.3)'}`,
        background: isYes ? 'rgba(76,175,80,0.15)' : isNo ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.06)',
        color: isYes ? '#4CAF50' : isNo ? '#ff6b6b' : 'var(--header-bg)',
      }}
    >
      {isYes ? '✓ Yes' : isNo ? '✗ No' : '—'}
    </button>
  );
}

export default function EditModal({ entry, onSave, onCancel, settings }) {
  const entryFee = parseFloat(settings?.fees?.entryFee) || 249;
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const firstInputRef = useRef(null);

  useEffect(() => {
    setErrors({});
    setForm({
      boaterFirst:    entry.boaterFirst    ?? '',
      boaterLast:     entry.boaterLast     ?? '',
      boaterSuffix:   entry.boaterSuffix   ?? '',
      boaterPhone:    formatPhone(entry.boaterPhone   ?? ''),
      boaterEmail:    entry.boaterEmail    ?? '',
      coAnglerFirst:  entry.coAnglerFirst  ?? '',
      coAnglerLast:   entry.coAnglerLast   ?? '',
      coAnglerSuffix: entry.coAnglerSuffix ?? '',
      coAnglerPhone:  formatPhone(entry.coAnglerPhone ?? ''),
      coAnglerEmail:  entry.coAnglerEmail  ?? '',
      boatNo:         entry.boatNo        ?? '',
      numFish:        entry.numFish       ?? '',
      lunkerWeight:   entry.lunkerWeight  ?? '',
      totalWeight:    entry.totalWeight   ?? '',
      lunker:         entry.lunker        ?? '',
      option:         entry.option        ?? '',
      paid:           entry.paid          ?? '',
      appSigned:      entry.appSigned     ?? '',
      buyIn:          entry.buyIn         ?? '',
      needsAttention: entry.needsAttention ?? false,
      rawWeight:      entry.rawWeight     ?? null,
      deadFish:       entry.deadFish      ?? 0,
      shortFish:      entry.shortFish     ?? 0,
      offWaterAt:     toDatetimeLocal(entry.offWaterAt ?? ''),
    });
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [entry]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  function swapAnglers() {
    setForm(prev => ({
      ...prev,
      boaterFirst:    prev.coAnglerFirst,   coAnglerFirst:  prev.boaterFirst,
      boaterLast:     prev.coAnglerLast,    coAnglerLast:   prev.boaterLast,
      boaterSuffix:   prev.coAnglerSuffix,  coAnglerSuffix: prev.boaterSuffix,
      boaterPhone:    prev.coAnglerPhone,   coAnglerPhone:  prev.boaterPhone,
      boaterEmail:    prev.coAnglerEmail,   coAnglerEmail:  prev.boaterEmail,
    }));
  }

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
    if (!entry?.id) {
      if (!form.boaterFirst.trim()) errs.boaterFirst = 'Required';
      if (!form.boaterLast.trim())  errs.boaterLast  = 'Required';
      if (!form.boaterPhone.trim()) errs.boaterPhone  = 'Required';
      const hasCoAngler = form.coAnglerFirst.trim() || form.coAnglerLast.trim();
      if (hasCoAngler && !form.coAnglerPhone.trim()) errs.coAnglerPhone = 'Required';
    }
    if (String(form.buyIn).trim() && isNaN(evalMath(String(form.buyIn)))) errs.buyIn = 'Invalid expression';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const numFields = ['numFish', 'lunkerWeight', 'totalWeight'];
    const statusFields = ['lunker', 'option', 'paid', 'appSigned'];
    const passthroughFields = ['rawWeight', 'deadFish', 'shortFish', 'needsAttention'];
    const data = {};
    Object.entries(form).forEach(([k, v]) => {
      if (passthroughFields.includes(k)) {
        data[k] = v;
      } else if (statusFields.includes(k)) {
        data[k] = v === '' ? '' : parseInt(v);
      } else if (numFields.includes(k)) {
        data[k] = v === '' ? '' : parseFloat(v);
      } else if (k === 'buyIn') {
        data[k] = v === '' ? '' : parseFloat((evalMath(String(v)) || 0).toFixed(2));
      } else if (k === 'offWaterAt') {
        if (entry?.id) {
          data.offWaterAt = v ? toSqliteUtc(v) : '';
          data.offWaterAtDirect = true;
        }
      } else {
        data[k] = typeof v === 'string' ? v.trim() : v;
      }
    });
    onSave(data);
  }

  const isNew = !entry?.id;

  const err = (field) => errors[field]
    ? <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors[field]}</div>
    : null;
  const errBorder = (field) => errors[field] ? { borderColor: '#ff6b6b' } : undefined;

  return (
    <div className="edit-overlay">
      <div className="edit-panel">
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>{isNew ? 'Add Entry' : 'Edit Entry'}</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="edit-section-label">Boater</div>
            <div className="edit-grid-2">
              <div className="form-field">
                <label htmlFor="em-boater-first">Boater First{isNew ? ' *' : ''}</label>
                <input ref={firstInputRef} id="em-boater-first" name="boaterFirst" type="text" value={form.boaterFirst} placeholder="First"
                       onChange={e => set('boaterFirst', e.target.value)}
                       style={errBorder('boaterFirst')} />
                {err('boaterFirst')}
              </div>
              <div className="form-field">
                <label htmlFor="em-boater-last">Boater Last{isNew ? ' *' : ''}</label>
                {isNew ? (
                  <ContactSuggest
                    value={form.boaterLast}
                    placeholder="Last"
                    onChange={v => set('boaterLast', v)}
                    onSelect={c => setForm(prev => ({ ...prev, boaterFirst: c.firstName, boaterLast: c.lastName, boaterSuffix: c.suffix || '', boaterPhone: c.phone, boaterEmail: c.email || prev.boaterEmail }))}
                    inputProps={{ id: 'em-boater-last', name: 'boaterLast', style: errBorder('boaterLast') }}
                  />
                ) : (
                  <input id="em-boater-last" name="boaterLast" type="text" value={form.boaterLast} placeholder="Last"
                         onChange={e => set('boaterLast', e.target.value)}
                         style={errBorder('boaterLast')} />
                )}
                {err('boaterLast')}
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="em-boater-suffix">Suffix</label>
                <select id="em-boater-suffix" value={form.boaterSuffix} onChange={e => set('boaterSuffix', e.target.value)} style={{ ...SUFFIX_STYLE, maxWidth: 120 }}>
                  {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="em-boater-phone">Boater Phone{isNew ? ' *' : ''}</label>
                <input id="em-boater-phone" name="boaterPhone" type="tel" value={form.boaterPhone} placeholder="555-123-4567"
                       onChange={e => set('boaterPhone', e.target.value)}
                       onBlur={e => set('boaterPhone', formatPhone(e.target.value))}
                       style={errBorder('boaterPhone')} />
                {err('boaterPhone')}
              </div>
              <div className="form-field">
                <label htmlFor="em-boater-email">Boater Email</label>
                <EmailInput id="em-boater-email" name="boaterEmail" value={form.boaterEmail} onChange={v => set('boaterEmail', v)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,200,160,0.15)' }} />
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
              <div style={{ flex: 1, height: 1, background: 'rgba(168,200,160,0.15)' }} />
            </div>

            <div className="edit-section-label">Co-Angler</div>
            <div className="edit-grid-2">
              <div className="form-field">
                <label htmlFor="em-co-first">Co-Angler First</label>
                <input id="em-co-first" name="coAnglerFirst" type="text" value={form.coAnglerFirst} placeholder="First"
                       onChange={e => set('coAnglerFirst', e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="em-co-last">Co-Angler Last</label>
                {isNew ? (
                  <ContactSuggest
                    value={form.coAnglerLast}
                    placeholder="Last"
                    onChange={v => set('coAnglerLast', v)}
                    onSelect={c => setForm(prev => ({ ...prev, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerSuffix: c.suffix || '', coAnglerPhone: c.phone, coAnglerEmail: c.email || prev.coAnglerEmail }))}
                    inputProps={{ id: 'em-co-last', name: 'coAnglerLast' }}
                  />
                ) : (
                  <input id="em-co-last" name="coAnglerLast" type="text" value={form.coAnglerLast} placeholder="Last"
                         onChange={e => set('coAnglerLast', e.target.value)} />
                )}
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="em-co-suffix">Suffix</label>
                <select id="em-co-suffix" value={form.coAnglerSuffix} onChange={e => set('coAnglerSuffix', e.target.value)} style={{ ...SUFFIX_STYLE, maxWidth: 120 }}>
                  {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="em-co-phone">Co-Angler Phone{isNew && (form.coAnglerFirst || form.coAnglerLast) ? ' *' : ''}</label>
                <input id="em-co-phone" name="coAnglerPhone" type="tel" value={form.coAnglerPhone} placeholder="555-123-4567"
                       onChange={e => set('coAnglerPhone', e.target.value)}
                       onBlur={e => set('coAnglerPhone', formatPhone(e.target.value))}
                       style={errBorder('coAnglerPhone')} />
                {err('coAnglerPhone')}
              </div>
              <div className="form-field">
                <label htmlFor="em-co-email">Co-Angler Email</label>
                <EmailInput id="em-co-email" name="coAnglerEmail" value={form.coAnglerEmail} onChange={v => set('coAnglerEmail', v)} />
              </div>
            </div>

            <div className="edit-section-label">Catch Details</div>
            <div className="edit-grid-3">
              <div className="form-field">
                <label htmlFor="em-boat-no">Boat #</label>
                <input id="em-boat-no" name="boatNo" type="text" value={form.boatNo} placeholder="42" inputMode="numeric"
                       onChange={e => set('boatNo', e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="em-num-fish"># Fish</label>
                <input id="em-num-fish" name="numFish" type="number" value={form.numFish} placeholder="0" min="0" max="10" inputMode="numeric"
                       onChange={e => set('numFish', e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="em-lunker-wt">Lunker Wt (lbs)</label>
                <input id="em-lunker-wt" name="lunkerWeight" type="number" value={form.lunkerWeight} placeholder="0.00" step="0.01" min="0" inputMode="decimal"
                       onChange={e => set('lunkerWeight', e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="em-total-wt">Total Wt (lbs)</label>
                <input id="em-total-wt" name="totalWeight" type="number" value={form.totalWeight} placeholder="0.00" step="0.01" min="0" inputMode="decimal"
                       onChange={e => set('totalWeight', e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="em-buy-in">Buy-In ($)</label>
                <input id="em-buy-in" name="buyIn" type="text" value={form.buyIn} placeholder="0.00" inputMode="decimal"
                       onChange={e => set('buyIn', e.target.value)}
                       onBlur={e => {
                         const result = evalMath(e.target.value);
                         if (!isNaN(result)) set('buyIn', parseFloat(result.toFixed(2)));
                       }}
                       style={errBorder('buyIn')} />
                {err('buyIn')}
              </div>
            </div>

            {(parseFloat(form.rawWeight) > 0 || parseInt(form.deadFish) > 0 || parseInt(form.shortFish) > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: '#ff9090' }}>
                    <strong>Deductions on record:</strong>
                    {parseFloat(form.rawWeight) > 0 && <span style={{ marginLeft: 8 }}>Scale {parseFloat(form.rawWeight).toFixed(2)} lbs</span>}
                    {parseInt(form.deadFish) > 0 && <span style={{ marginLeft: 8 }}>{form.deadFish} dead</span>}
                    {parseInt(form.shortFish) > 0 && <span style={{ marginLeft: 8 }}>{form.shortFish} short</span>}
                  </div>
                  <button type="button" className="btn btn-danger btn-sm"
                    onClick={() => setForm(prev => ({ ...prev, rawWeight: null, deadFish: 0, shortFish: 0 }))}>
                    ✕ Clear Deductions
                  </button>
                </div>
              </div>
            )}

            <div className="edit-section-label">Payment &amp; Status</div>
            <div className="edit-grid-4">
              {[
                { key: 'lunker',    label: 'Lunker Paid' },
                { key: 'option',    label: 'Option Paid' },
                { key: 'paid',      label: 'Entry Paid'  },
                { key: 'appSigned', label: 'App Signed'  },
              ].map(({ key, label }) => (
                <div key={key} className="form-field">
                  <span className="field-label">{label}</span>
                  <ToggleButton value={form[key]} onChange={v => set(key, v)} />
                </div>
              ))}
            </div>

            {!isNew && (
              <div style={{ marginTop: 14 }}>
                <div className="edit-section-label">Timestamps</div>
                <div className="form-field">
                  <label htmlFor="em-off-water-at" style={{ fontSize: 12, fontWeight: 700, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, display: 'block' }}>
                    Off Water Time
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      id="em-off-water-at"
                      name="offWaterAt"
                      type="datetime-local"
                      value={form.offWaterAt}
                      onChange={e => set('offWaterAt', e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(139,180,225,0.3)', borderRadius: 8, color: 'var(--white)', fontSize: 14, padding: '9px 12px', outline: 'none', colorScheme: 'dark' }}
                    />
                    {form.offWaterAt && (
                      <button type="button" onClick={() => set('offWaterAt', '')}
                        style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.1)', color: '#ff9090', whiteSpace: 'nowrap' }}>
                        ✕ Clear
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--header-bg)', marginTop: 4 }}>
                    {form.offWaterAt ? 'Time shown in your local timezone.' : 'Not set — clearing removes the off-water record.'}
                  </div>
                </div>
              </div>
            )}

            {form.needsAttention && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                               background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.35)',
                               borderRadius: 8, padding: '10px 14px' }}>
                  <input type="checkbox" checked={form.needsAttention}
                         onChange={e => set('needsAttention', e.target.checked)}
                         style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <span style={{ color: '#ffb450', fontWeight: 700, fontSize: 13 }}>
                    ⚠️ Flagged for attention — uncheck to clear
                  </span>
                </label>
              </div>
            )}

            <div className="edit-panel-actions">
              <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn btn-gold btn-lg">✔ Save Entry</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
