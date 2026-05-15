import { useMemo, useState, useEffect } from 'react';
import { marked } from 'marked';
import QRCode from 'qrcode';
import rulesRaw from '../content/rules.md?raw';

marked.setOptions({ breaks: true });

const SITE_URL = 'https://sft-summer-slam.pages.dev';

export default function RulesTab({ settings }) {
  const year          = new Date().getFullYear();
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(SITE_URL, { width: 160, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, []);
  const entryFee      = parseFloat(settings?.fees?.entryFee             || 250).toFixed(2);
  const opt1          = parseInt(settings?.fees?.option1Pct             || 70);
  const opt2          = 100 - opt1;
  const deadFishPen   = parseFloat(settings?.penalties?.deadFishPenalty  || 0.5).toFixed(2);
  const shortFishPen  = parseFloat(settings?.penalties?.shortFishPenalty || 1.0).toFixed(2);
  const overLimitPen  = parseFloat(settings?.penalties?.overLimitPenalty || 3.0).toFixed(2);
  const maxFish       = parseInt(settings?.penalties?.maxFish              || 5);
  const latePenPerMin = parseFloat(settings?.penalties?.latePenaltyPerMin  || 1.0).toFixed(2);
  const lateDQMin     = parseInt(settings?.penalties?.latePenaltyDQMin     || 15);

  const qrImg = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="QR Code — ${SITE_URL}" style="width:160px;height:160px;display:block;margin:12px 0;">`
    : '';

  const html = useMemo(() => {
    const md = rulesRaw
      .replace(/\{\{YEAR\}\}/g,            String(year))
      .replace(/\{\{ENTRY_FEE\}\}/g,       entryFee)
      .replace(/\{\{OPTION1_PCT\}\}/g,     String(opt1))
      .replace(/\{\{OPTION2_PCT\}\}/g,     String(opt2))
      .replace(/\{\{DEAD_FISH_PEN\}\}/g,   deadFishPen)
      .replace(/\{\{SHORT_FISH_PEN\}\}/g,  shortFishPen)
      .replace(/\{\{OVER_LIMIT_PEN\}\}/g,  overLimitPen)
      .replace(/\{\{MAX_FISH\}\}/g,        String(maxFish))
      .replace(/\{\{LATE_PEN_PER_MIN\}\}/g, latePenPerMin)
      .replace(/\{\{LATE_DQ_MIN\}\}/g,     String(lateDQMin))
      .replace(/\{\{QR_CODE\}\}/g,         qrImg);
    return marked(md);
  }, [year, entryFee, opt1, opt2, deadFishPen, shortFishPen, overLimitPen, maxFish, latePenPerMin, lateDQMin, qrImg]);

  function handleCreatePdf() {
    const base = `${window.location.protocol}//${window.location.host}`;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<base href="${base}">
<title>Summer Slam ${year} — Rules</title>
<style>
  body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #000; }
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 24px; }
  h2 { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
       margin: 22px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
  p  { font-size: 14px; line-height: 1.65; margin: 0 0 10px; }
  ol, ul { padding-left: 22px; margin: 0 0 10px; }
  li { font-size: 14px; line-height: 1.65; margin-bottom: 6px; }
  strong { font-weight: bold; }
  hr { border: none; border-top: 1px solid #ccc; margin: 18px 0; }
</style>
</head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

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
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-outline" onClick={handleCreatePdf} style={{ fontSize: 13, padding: '7px 16px' }}>
          📄 Create PDF
        </button>
      </div>
      <div className="rules-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
