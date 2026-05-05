import { getStats } from '../utils/calculations';

export default function Header({ entries, settings, activeTab, onTabChange, onThemeToggle }) {
  const stats = getStats(entries, settings.fees);

  return (
    <header>
      <div className="header-top">
        <div className="logo">
          <span className="logo-icon">🎣</span>
          <div className="logo-text">
            <h1>Summer Slam!</h1>
            <p>Bass Tournament Management</p>
          </div>
        </div>
        <button className="theme-toggle" onClick={onThemeToggle}>
          {settings.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="val">{stats.totalBoats}</span>
            <span className="lbl">Boats</span>
          </div>
          <div className="stat-chip">
            <span className="val">{stats.lunkerToBeat} lbs</span>
            <span className="lbl">Top Lunker</span>
          </div>
          <div className="stat-chip">
            <span className="val">{stats.largestBag} lbs</span>
            <span className="lbl">Largest Bag</span>
          </div>
          <div className="stat-chip" style={{ borderColor: 'rgba(255,180,80,0.4)' }}>
            <span className="val" style={{ color: '#ffb450' }}>${stats.lunkerPot}</span>
            <span className="lbl">🎣 Lunker Pot</span>
            <span className="lbl" style={{ color: 'rgba(255,180,80,0.7)' }}>{stats.lunkerPaidCount} paid</span>
          </div>
          <div className="stat-chip" style={{ borderColor: 'rgba(120,200,255,0.4)' }}>
            <span className="val" style={{ color: '#78c8ff' }}>${stats.optionPot}</span>
            <span className="lbl">⚡ Option Pot</span>
            <span className="lbl" style={{ color: 'rgba(120,200,255,0.7)' }}>{stats.optionPaidCount} paid</span>
          </div>
          <div className="stat-chip">
            <span className="val">${stats.totalBuyIn}</span>
            <span className="lbl">Total Buy-In</span>
          </div>
        </div>
      </div>
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => onTabChange('roster')}
        >
          📋 Roster
        </button>
        <button
          className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => onTabChange('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>
    </header>
  );
}
