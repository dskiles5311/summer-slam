export default function RulesTab() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const pdfPath = `/summer-slam-${new Date().getFullYear()}-rules.pdf`;

  if (isIOS) {
    const fullUrl = `${window.location.origin}${pdfPath}`;
    const viewerSrc = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fullUrl)}`;
    return (
      <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 160px)', overflow: 'hidden' }}>
        <iframe
          src={viewerSrc}
          title="Tournament Rules"
          style={{ flex: 1, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
        />
      </div>
    );
  }

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 160px)', overflow: 'hidden' }}>
      <iframe
        src={pdfPath}
        title="Tournament Rules"
        style={{ flex: 1, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
      />
    </div>
  );
}
