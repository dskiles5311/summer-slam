export function evalMath(expr) {
  const s = String(expr ?? '').trim();
  if (!s) return NaN;
  if (!/^[\d\s+\-*/().]+$/.test(s)) return NaN;
  let pos = 0;

  function skipWs() { while (pos < s.length && s[pos] === ' ') pos++; }

  function parseAddSub() {
    let left = parseMulDiv();
    for (;;) {
      skipWs();
      if (s[pos] !== '+' && s[pos] !== '-') break;
      const op = s[pos++];
      left = op === '+' ? left + parseMulDiv() : left - parseMulDiv();
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    for (;;) {
      skipWs();
      if (s[pos] !== '*' && s[pos] !== '/') break;
      const op = s[pos++];
      const right = parseUnary();
      if (op === '/' && right === 0) return NaN;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseUnary() {
    skipWs();
    if (s[pos] === '-') { pos++; return -parsePrimary(); }
    if (s[pos] === '+') { pos++; return parsePrimary(); }
    return parsePrimary();
  }

  function parsePrimary() {
    skipWs();
    if (s[pos] === '(') {
      pos++;
      const val = parseAddSub();
      skipWs();
      if (s[pos] === ')') pos++;
      return val;
    }
    const start = pos;
    while (pos < s.length && /[\d.]/.test(s[pos])) pos++;
    if (pos === start) return NaN;
    return parseFloat(s.slice(start, pos));
  }

  try {
    const result = parseAddSub();
    return isFinite(result) ? result : NaN;
  } catch { return NaN; }
}
