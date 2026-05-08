export default function RulesTab() {
  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
      <iframe
        src="/summer-slam-2026-rules.pdf"
        title="Tournament Rules"
        style={{ flex: 1, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
      />
    </div>
  );
}
