import { useMemo } from 'react';
import { marked } from 'marked';
import offLimitsRaw from '../content/offlimits.md?raw';

marked.setOptions({ breaks: true });

export default function OffLimitsTab({ settings }) {
  const year = new Date().getFullYear();

  const flightTimesMd = useMemo(() => {
    const flights = (settings?.flights || [])
      .slice()
      .sort((a, b) => (parseInt(a.boatStart) || 0) - (parseInt(b.boatStart) || 0));
    if (!flights.length) return '_No weigh-in times configured yet. Add flights in Settings._';
    const rows = flights.map(f => {
      const start = String(f.boatStart).padStart(2, '0');
      const end   = String(f.boatEnd).padStart(2, '0');
      return `| Boats ${start}–${end} | ${f.checkInTime || '—'} |`;
    });
    return `| Boats | Weigh-In Time |\n|-------|---------------|\n${rows.join('\n')}`;
  }, [settings?.flights]);

  const html = useMemo(() => {
    const md = offLimitsRaw
      .replace(/\{\{YEAR\}\}/g,         String(year))
      .replace(/\{\{FLIGHT_TIMES\}\}/g, flightTimesMd);
    return marked(md);
  }, [year, flightTimesMd]);

  return (
    <div className="tab-panel active" style={{ overflowY: 'auto', padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <style>{`
        .rules-body h1 { font-size: 22px; font-weight: 800; color: var(--gold-light); margin: 0 0 24px; }
        .rules-body h2 { font-size: 15px; font-weight: 700; color: var(--header-bg); text-transform: uppercase;
                         letter-spacing: 0.8px; margin: 22px 0 6px; padding-bottom: 4px;
                         border-bottom: 1px solid rgba(139,180,225,0.2); }
        .rules-body p  { font-size: 14px; line-height: 1.65; color: var(--white); margin: 0 0 10px; }
        .rules-body ol, .rules-body ul { padding-left: 22px; margin: 0 0 10px; }
        .rules-body li { font-size: 14px; line-height: 1.65; color: var(--white); margin-bottom: 6px; }
        .rules-body strong { color: var(--gold-light); }
        .rules-body hr { border: none; border-top: 1px solid rgba(139,180,225,0.2); margin: 18px 0; }
        .rules-body table { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
        .rules-body th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--header-bg);
                         padding: 6px 12px; border-bottom: 1px solid rgba(139,180,225,0.25); text-align: left; }
        .rules-body td { font-size: 14px; color: var(--white); padding: 6px 12px;
                         border-bottom: 1px solid rgba(255,255,255,0.06); }
      `}</style>
      <div className="rules-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
