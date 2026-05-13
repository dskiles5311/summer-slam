import { useMemo } from 'react';
import { marked } from 'marked';
import rulesRaw from '../content/rules.md?raw';

marked.setOptions({ breaks: true });

export default function RulesTab({ settings }) {
  const year       = new Date().getFullYear();
  const entryFee   = parseFloat(settings?.fees?.entryFee  || 250).toFixed(2);
  const opt1       = parseInt(settings?.fees?.option1Pct  || 70);
  const opt2       = 100 - opt1;

  const html = useMemo(() => {
    const md = rulesRaw
      .replace(/\{\{YEAR\}\}/g,        String(year))
      .replace(/\{\{ENTRY_FEE\}\}/g,   entryFee)
      .replace(/\{\{OPTION1_PCT\}\}/g, String(opt1))
      .replace(/\{\{OPTION2_PCT\}\}/g, String(opt2));
    return marked(md);
  }, [year, entryFee, opt1, opt2]);

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
      `}</style>
      <div className="rules-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
