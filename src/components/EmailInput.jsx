import { useState, useRef, useEffect } from 'react';

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

export default function EmailInput({ value, onChange, onBlur, style, placeholder = 'angler@example.com', id, name }) {
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  useEffect(() => {
    if (!suggestions.length) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setSuggestions([]);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [suggestions.length]);

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);

    const atIdx = val.indexOf('@');
    if (atIdx === -1) { setSuggestions([]); return; }

    const afterAt = val.slice(atIdx + 1).toLowerCase();
    const filtered = DOMAINS.filter(d => d.startsWith(afterAt));
    setSuggestions(filtered.length && afterAt !== filtered[0] ? filtered : []);
    setActiveIdx(-1);
  }

  function pick(domain) {
    const atIdx = value.indexOf('@');
    const newVal = (atIdx === -1 ? value : value.slice(0, atIdx + 1)) + domain;
    onChange(newVal);
    setSuggestions([]);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]); }
      else if (suggestions.length === 1) { e.preventDefault(); pick(suggestions[0]); }
      else { setSuggestions([]); }
    } else if (e.key === 'Escape') { setSuggestions([]); }
  }

  function handleBlur(e) {
    // Delay so mousedown on suggestion fires first
    setTimeout(() => {
      setSuggestions([]);
      onBlur?.(e);
    }, 120);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="email"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        id={id}
        name={name}
        style={{ ...style, width: '100%', boxSizing: 'border-box' }}
        autoComplete="off"
        inputMode="email"
      />
      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--navy)', border: '1px solid rgba(139,180,225,0.25)',
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          zIndex: 200, overflow: 'hidden',
        }}>
          {suggestions.map((d, i) => {
            const atIdx = value.indexOf('@');
            const user  = atIdx === -1 ? value : value.slice(0, atIdx + 1);
            return (
              <div key={d}
                onMouseDown={() => pick(d)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                  color: 'var(--white)',
                  background: i === activeIdx ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}>
                <span style={{ opacity: 0.5 }}>{user}</span>{d}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
