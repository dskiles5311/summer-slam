import { useState, useEffect, useRef } from 'react';
import { searchContacts } from '../utils/api';
import { formatPhone } from '../utils/phone';

const ITEM_STYLE = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(168,200,160,0.15)',
};

const DROP_STYLE = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  left: 0,
  right: 0,
  zIndex: 2000,
  background: 'var(--navy-mid)',
  border: '1px solid rgba(168,200,160,0.4)',
  borderRadius: 6,
  maxHeight: 220,
  overflowY: 'auto',
  boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
};

export default function ContactSuggest({ value, placeholder, onChange, onSelect, inputRef, inputProps = {} }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const results = await searchContacts(value);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActive(-1);
    }, 280);
    return () => clearTimeout(timer.current);
  }, [value]);

  useEffect(() => {
    function close(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(suggestions[active]); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  function select(contact) {
    onSelect(contact);
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        {...inputProps}
      />
      {open && (
        <div style={DROP_STYLE}>
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              onMouseDown={() => select(s)}
              style={{ ...ITEM_STYLE, background: i === active ? 'rgba(139,180,225,0.12)' : 'transparent', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 600, color: 'var(--white)' }}>{s.firstName} {s.lastName}</span>
                {s.phone && <span style={{ color: 'var(--header-bg)', fontSize: 12 }}>{formatPhone(s.phone)}</span>}
              </div>
              {s.email && <span style={{ color: 'var(--header-bg)', fontSize: 11, opacity: 0.8 }}>{s.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
