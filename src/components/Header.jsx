
import { useRef, useEffect } from 'react';
import { getStats } from '../utils/calculations';

export default function Header({ entries, settings, activeTab, onTabChange, onThemeToggle, isUnlocked, onToggleLock, buyInBlurred, onToggleBuyInBlur }) {
  const stats = getStats(entries, settings.fees);
  const buyInFilter = buyInBlurred ? 'blur(6px)' : 'none';
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector('.nav-tab.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  return (
    <header>
      <div className="header-top">
        <div style={{ flex: 1 }} />
        <div className="logo-text" style={{ textAlign: 'center' }}>
          <h1>{new Date().getFullYear()} Summer Slam!</h1>
          <p>Susquehanna Fishing Tackle</p>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
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
      </div>
      <div className="stats-bar">
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
            <div className="stat-chip" onClick={onToggleBuyInBlur}
                 title={buyInBlurred ? 'Tap to reveal' : 'Tap to hide'}
                 style={{ cursor: 'pointer', userSelect: 'none' }}>
              <span className="val" style={{ filter: buyInFilter, transition: 'filter 0.25s' }}>
                ${stats.totalBuyIn}
              </span>
              <span className="lbl">Total Buy-In</span>
            </div>
          )}
        </div>
      </div>
      <div className="nav-tabs-wrap">
      <nav className="nav-tabs" ref={navRef}>
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => onTabChange('signup')}
          >
            📝 Sign Up
          </button>
        )}
        <button
          className={`nav-tab ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => onTabChange('roster')}
        >
          📋 Roster
        </button>
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'checkin' ? 'active' : ''}`}
            onClick={() => onTabChange('checkin')}
          >
            ✅ Check In
          </button>
        )}
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'boatcheck' ? 'active' : ''}`}
            onClick={() => onTabChange('boatcheck')}
          >
            ⚓ Boat Check
          </button>
        )}
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'weighin' ? 'active' : ''}`}
            onClick={() => onTabChange('weighin')}
          >
            🎣 Weigh In
          </button>
        )}
        <button
          className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => onTabChange('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`nav-tab ${activeTab === 'flights' ? 'active' : ''}`}
          onClick={() => onTabChange('flights')}
        >
          Flights
        </button>
        <button
          className={`nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => onTabChange('rules')}
        >
          📋 Rules
        </button>
        {isUnlocked && (
          <button
            className={`nav-tab ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => onTabChange('contacts')}
          >
            👥 Contacts
          </button>
        )}
        <button
          className={`nav-tab ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => onTabChange('archive')}
        >
          🗂️ Archive
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
      </div>
    </header>
  );
}
