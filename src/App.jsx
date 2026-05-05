import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import RosterTab from './components/RosterTab';
import LeaderboardTab from './components/LeaderboardTab';
import SettingsTab from './components/SettingsTab';
import EditModal from './components/EditModal';
import UnlockModal from './components/UnlockModal';
import Toast from './components/Toast';
import {
  fetchEntries, createEntry, updateEntry, deleteEntry,
  fetchSettings, saveSettings, verifyPassword, storePassword, clearPassword, isPasswordStored,
} from './utils/api';
import { calcRanks } from './utils/calculations';

const DEFAULT_SETTINGS = {
  fees:            { entryFee: 249, lunkerFee: 10, optFee: 20 },
  payoutSettings:  { totalPayout: 0, numWinners: 10, payouts: [] },
  theme:           'dark',
};

export default function App() {
  const [entries, setEntries]           = useState([]);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab]       = useState('roster');
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isUnlocked, setIsUnlocked]     = useState(() => isPasswordStored());
  const [showUnlock, setShowUnlock]     = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const rankedEntries = calcRanks(entries);

  useEffect(() => {
    async function loadData() {
      try {
        const [entriesData, settingsData] = await Promise.all([fetchEntries(), fetchSettings()]);
        setEntries(entriesData);
        if (settingsData && Object.keys(settingsData).length > 0) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...settingsData,
            fees:           { ...DEFAULT_SETTINGS.fees,           ...(settingsData.fees           || {}) },
            payoutSettings: { ...DEFAULT_SETTINGS.payoutSettings, ...(settingsData.payoutSettings || {}) },
          });
        }
      } catch {
        showToast('Failed to connect to database', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [showToast]);

  useEffect(() => {
    document.body.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  async function handleUnlock(password) {
    await verifyPassword(password);
    storePassword(password);
    setIsUnlocked(true);
    setShowUnlock(false);
  }

  function handleLock() {
    clearPassword();
    setIsUnlocked(false);
  }

  async function handleSaveEntry(entryData) {
    try {
      if (editingEntry?.id) {
        const updated = await updateEntry(editingEntry.id, entryData);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        showToast('Entry saved!', 'success');
      } else {
        const created = await createEntry(entryData);
        setEntries(prev => [...prev, created]);
        showToast('Entry added!', 'success');
      }
      setEditingEntry(null);
    } catch {
      showToast('Failed to save entry', 'error');
    }
  }

  async function handleDeleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      showToast('Entry deleted', 'info');
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  }

  async function handleUpdateSettings(updates) {
    const newSettings = {
      ...settings,
      ...updates,
      fees:           updates.fees           ? { ...settings.fees,           ...updates.fees           } : settings.fees,
      payoutSettings: updates.payoutSettings ? { ...settings.payoutSettings, ...updates.payoutSettings } : settings.payoutSettings,
    };
    setSettings(newSettings);
    try {
      await saveSettings(newSettings);
    } catch {
      showToast('Failed to save settings', 'error');
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear ALL data? This cannot be undone!')) return;
    try {
      await Promise.all(entries.map(e => deleteEntry(e.id)));
      setEntries([]);
      showToast('All data cleared', 'info');
    } catch {
      showToast('Failed to clear data', 'error');
    }
  }

  async function handleImport(newEntries) {
    try {
      const created = await Promise.all(newEntries.map(e => createEntry(e)));
      setEntries(prev => [...prev, ...created]);
      showToast(`Imported ${created.length} entries`, 'success');
    } catch {
      showToast('Import failed', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
        <div style={{ fontSize: 56 }}>🎣</div>
        <p style={{ color: 'var(--header-bg)', fontSize: 16 }}>Loading tournament data…</p>
      </div>
    );
  }

  return (
    <div id="app">
      <Header
        entries={rankedEntries}
        settings={settings}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onThemeToggle={() => handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        isUnlocked={isUnlocked}
        onToggleLock={() => isUnlocked ? handleLock() : setShowUnlock(true)}
      />

      <main>
        {activeTab === 'roster' && (
          <RosterTab
            entries={rankedEntries}
            settings={settings}
            isUnlocked={isUnlocked}
            onEdit={setEditingEntry}
            onAdd={() => setEditingEntry({})}
            onDelete={handleDeleteEntry}
            onClearAll={handleClearAll}
            onImport={handleImport}
          />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab entries={rankedEntries} settings={settings} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            entries={rankedEntries}
            isUnlocked={isUnlocked}
            onUpdateSettings={handleUpdateSettings}
            onClearAll={handleClearAll}
            onImport={handleImport}
          />
        )}
      </main>

      {editingEntry !== null && (
        <EditModal
          entry={editingEntry}
          onSave={handleSaveEntry}
          onCancel={() => setEditingEntry(null)}
        />
      )}

      {showUnlock && (
        <UnlockModal
          onUnlock={handleUnlock}
          onCancel={() => setShowUnlock(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
