import { useState, useEffect, useRef } from 'react';

const EMPTY = {
  boaterFirst: '', boaterLast: '',
  coAnglerFirst: '', coAnglerLast: '',
  boatNo: '', numFish: '', lunkerWeight: '', totalWeight: '',
  lunker: '', option: '', paid: '', appSigned: '', buyIn: '',
};

export default function EditModal({ entry, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY });
  const firstInputRef = useRef(null);

  useEffect(() => {
    setForm({
      boaterFirst:   entry.boaterFirst   ?? '',
      boaterLast:    entry.boaterLast    ?? '',
      coAnglerFirst: entry.coAnglerFirst ?? '',
      coAnglerLast:  entry.coAnglerLast  ?? '',
      boatNo:        entry.boatNo        ?? '',
      numFish:       entry.numFish       ?? '',
      lunkerWeight:  entry.lunkerWeight  ?? '',
      totalWeight:   entry.totalWeight   ?? '',
      lunker:        entry.lunker        ?? '',
      option:        entry.option        ?? '',
      paid:          entry.paid          ?? '',
      appSigned:     entry.appSigned     ?? '',
      buyIn:         entry.buyIn         ?? '',
    });
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [entry]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const numFields = ['numFish', 'lunkerWeight', 'totalWeight', 'buyIn'];
    const statusFields = ['lunker', 'option', 'paid', 'appSigned'];
    const data = {};
    Object.entries(form).forEach(([k, v]) => {
      if (statusFields.includes(k)) {
        data[k] = v === '' ? '' : parseInt(v);
      } else if (numFields.includes(k)) {
        data[k] = v === '' ? '' : parseFloat(v);
      } else {
        data[k] = v;
      }
    });
    onSave(data);
  }

  const isNew = !entry?.id;

  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="edit-panel">
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>{isNew ? 'Add Entry' : 'Edit Entry'}</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="edit-section-label">Boater &amp; Co-Angler</div>
            <div className="edit-grid-2">
              <div className="form-field">
                <label>Boater First</label>
                <input ref={firstInputRef} type="text" value={form.boaterFirst} placeholder="First"
                       autoComplete="given-name"
                       onChange={e => set('boaterFirst', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Boater Last</label>
                <input type="text" value={form.boaterLast} placeholder="Last"
                       autoComplete="family-name"
                       onChange={e => set('boaterLast', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Co-Angler First</label>
                <input type="text" value={form.coAnglerFirst} placeholder="First"
                       onChange={e => set('coAnglerFirst', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Co-Angler Last</label>
                <input type="text" value={form.coAnglerLast} placeholder="Last"
                       onChange={e => set('coAnglerLast', e.target.value)} />
              </div>
            </div>

            <div className="edit-section-label">Catch Details</div>
            <div className="edit-grid-3">
              <div className="form-field">
                <label>Boat #</label>
                <input type="text" value={form.boatNo} placeholder="42" inputMode="numeric"
                       onChange={e => set('boatNo', e.target.value)} />
              </div>
              <div className="form-field">
                <label># Fish</label>
                <input type="number" value={form.numFish} placeholder="0" min="0" max="10" inputMode="numeric"
                       onChange={e => set('numFish', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Lunker Wt (lbs)</label>
                <input type="number" value={form.lunkerWeight} placeholder="0.00" step="0.01" min="0" inputMode="decimal"
                       onChange={e => set('lunkerWeight', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Total Wt (lbs)</label>
                <input type="number" value={form.totalWeight} placeholder="0.00" step="0.01" min="0" inputMode="decimal"
                       onChange={e => set('totalWeight', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Buy-In ($)</label>
                <input type="number" value={form.buyIn} placeholder="0.00" step="0.01" min="0" inputMode="decimal"
                       onChange={e => set('buyIn', e.target.value)} />
              </div>
            </div>

            <div className="edit-section-label">Payment &amp; Status</div>
            <div className="edit-grid-4">
              <div className="form-field">
                <label>Lunker Paid</label>
                <select value={form.lunker} onChange={e => set('lunker', e.target.value)}>
                  <option value="">—</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div className="form-field">
                <label>Option Paid</label>
                <select value={form.option} onChange={e => set('option', e.target.value)}>
                  <option value="">—</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div className="form-field">
                <label>Entry Paid</label>
                <select value={form.paid} onChange={e => set('paid', e.target.value)}>
                  <option value="">—</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div className="form-field">
                <label>App Signed</label>
                <select value={form.appSigned} onChange={e => set('appSigned', e.target.value)}>
                  <option value="">—</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

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
