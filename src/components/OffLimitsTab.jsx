import { useMemo, useState, useEffect } from 'react';
import { marked } from 'marked';
import QRCode from 'qrcode';
import offLimitsRaw from '../content/offlimits.md?raw';

marked.setOptions({ breaks: true });

const SITE_URL = 'https://sft-summer-slam.pages.dev';

export default function OffLimitsTab({ settings }) {
  const year      = new Date().getFullYear();
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(SITE_URL, { width: 160, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, []);
  const maxFish   = parseInt(settings?.penalties?.maxFish)       || 5;
  const minLength = parseInt(settings?.penalties?.minFishLength) || 15;

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

  const qrImg = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="QR Code — ${SITE_URL}" style="width:160px;height:160px;display:block;margin:12px 0;">`
    : '';

  const html = useMemo(() => {
    const md = offLimitsRaw
      .replace(/\{\{YEAR\}\}/g,         String(year))
      .replace(/\{\{MAX_FISH\}\}/g,     String(maxFish))
      .replace(/\{\{MIN_LENGTH\}\}/g,   String(minLength))
      .replace(/\{\{FLIGHT_TIMES\}\}/g, flightTimesMd)
      .replace(/\{\{QR_CODE\}\}/g,      qrImg);
    return marked(md);
  }, [year, maxFish, minLength, flightTimesMd, qrImg]);

  function handleCreatePdf() {
    const base = `${window.location.protocol}//${window.location.host}`;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<base href="${base}">
<title>Summer Slam ${year} — Off Limits</title>
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
  table { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px;
       padding: 6px 12px; border-bottom: 1px solid #ccc; text-align: left; }
  td { font-size: 14px; padding: 6px 12px; border-bottom: 1px solid #eee; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0 16px;
        border: 1px solid #ccc; display: block; }
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
        .rules-body hr { border: none; border-top: 1px solid rgba(139,180,225,0.2); margin: 18px 0; }
        .rules-body table { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
        .rules-body th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--header-bg);
                         padding: 6px 12px; border-bottom: 1px solid rgba(139,180,225,0.25); text-align: left; }
        .rules-body td { font-size: 14px; color: var(--white); padding: 6px 12px;
                         border-bottom: 1px solid rgba(255,255,255,0.06); }
        .rules-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0 16px;
                          border: 1px solid rgba(139,180,225,0.2); display: block; }
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
