export function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 7)  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 6)  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw || '';
}
