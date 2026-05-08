import { getStats } from '../utils/calculations';

export default function Header({ entries, settings, activeTab, onTabChange, onThemeToggle, isUnlocked, onToggleLock }) {
  const stats = getStats(entries, settings.fees);

  return (
    <header>
      <div className="header-top">
        <div className="logo">
          <img src="/SFT%20logo%20color.jpg" alt="SFT" className="logo-icon" style={{ width: 80, height: 80, objectFit: 'contain' }} />
          <div className="logo-text">
            <h1>{new Date().getFullYear()} Summer Slam!</h1>
            <p>Susquehanna Fishing Tackle</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="theme-toggle" onClick={onThemeToggle}>
            {settings.theme === 'dark' ? '☀️ Light' : settings.theme === 'light' ? '🏕️ Outdoor' : '🌙 Dark'}
          </button>
          <button
            className="theme-toggle"
            onClick={onToggleLock}
            title={isUnlocked ? 'Lock editing' : 'Unlock editing'}
            style={{ opacity: isUnlocked ? 1 : 0.7 }}
          >
            {isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}
          </button>
        </div>
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
            <span className="lbl">🎯 Lunker Pot</span>
            <span className="lbl" style={{ color: 'rgba(255,180,80,0.7)' }}>{stats.lunkerPaidCount} paid</span>
          </div>
          <div className="stat-chip" style={{ borderColor: 'rgba(120,200,255,0.4)' }}>
            <span className="val" style={{ color: '#78c8ff' }}>${stats.optionPot}</span>
            <span className="lbl">⚡ Option Pot</span>
            <span className="lbl" style={{ color: 'rgba(120,200,255,0.7)' }}>{stats.optionPaidCount} paid</span>
          </div>
          {isUnlocked && (
            <div className="stat-chip">
              <span className="val">${stats.totalBuyIn}</span>
              <span className="lbl">Total Buy-In</span>
            </div>
          )}
        </div>
      </div>
      <nav className="nav-tabs">
        {isUnlocked && (
          <>
            <button
              className={`nav-tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => onTabChange('signup')}
            >
              📝 Sign Up
            </button>
            <button
              className={`nav-tab ${activeTab === 'roster' ? 'active' : ''}`}
              onClick={() => onTabChange('roster')}
            >
              📋 Roster
            </button>
            <button
              className={`nav-tab ${activeTab === 'boatcheck' ? 'active' : ''}`}
              onClick={() => onTabChange('boatcheck')}
            >
              ⚓ Boat Check
            </button>
            <button
              className={`nav-tab ${activeTab === 'weighin' ? 'active' : ''}`}
              onClick={() => onTabChange('weighin')}
            >
              🎣 Weigh In
            </button>
          </>
        )}
        <button
          className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => onTabChange('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => onTabChange('rules')}
        >
          📋 Rules
        </button>
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
          >
            ⚙️ Settings
          </button>
        )}
      </nav>
    </header>
  );
}
