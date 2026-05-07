import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import RosterTab from './components/RosterTab';
import BoatCheckTab from './components/BoatCheckTab';
import WeighInTab from './components/WeighInTab';
import LeaderboardTab from './components/LeaderboardTab';
import RulesTab from './components/RulesTab';
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
  boatCheck:       {},
  offWater:        {},
};

export default function App() {
  const [entries, setEntries]           = useState([]);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab]       = useState(() => 'leaderboard');
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [leaderboardTopN, setLeaderboardTopN] = useState(10);
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
          const n = settingsData.payoutSettings?.numWinners;
          if (n) setLeaderboardTopN(n);
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

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [entriesData, settingsData] = await Promise.all([fetchEntries(), fetchSettings()]);
        setEntries(prev => JSON.stringify(prev) !== JSON.stringify(entriesData) ? entriesData : prev);
        if (settingsData && Object.keys(settingsData).length > 0) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...settingsData,
            fees:           { ...DEFAULT_SETTINGS.fees,           ...(settingsData.fees           || {}) },
            payoutSettings: { ...DEFAULT_SETTINGS.payoutSettings, ...(settingsData.payoutSettings || {}) },
          };
          setSettings(prev => JSON.stringify(prev) !== JSON.stringify(merged) ? merged : prev);
        }
      } catch { /* silently skip if fetch fails */ }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleUnlock(password) {
    await verifyPassword(password);
    storePassword(password);
    setIsUnlocked(true);
    setShowUnlock(false);
  }

  function handleLock() {
    clearPassword();
    setIsUnlocked(false);
    setActiveTab(prev => (prev === 'rules' ? 'rules' : 'leaderboard'));
  }

  async function handleSaveEntry(entryData) {
    try {
      const duplicate = entryData.boatNo && entries.some(e =>
        String(e.boatNo) === String(entryData.boatNo) && e.id !== editingEntry?.id
      );

      if (editingEntry?.id) {
        const updated = await updateEntry(editingEntry.id, entryData);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry saved!', duplicate ? 'warning' : 'success');
      } else {
        const created = await createEntry(entryData);
        setEntries(prev => [...prev, created]);
        showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry added!', duplicate ? 'warning' : 'success');
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

  async function handleToggleEntryField(entryId, field) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const next = (entry[field] === 1 || entry[field] === '1') ? 0 : 1;
    try {
      const updated = await updateEntry(entryId, { ...entry, [field]: next });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch {
      showToast('Failed to update', 'error');
    }
  }

  async function handleToggleBoatCheck(id) {
    const current = settings.boatCheck || {};
    const nowChecked = !current[id];
    const offWater = settings.offWater || {};
    const updates = { boatCheck: { ...current, [id]: nowChecked } };
    if (!nowChecked) updates.offWater = { ...offWater, [id]: false };
    await handleUpdateSettings(updates);
  }

  async function handleToggleOffWater(id) {
    const current = settings.offWater || {};
    await handleUpdateSettings({ offWater: { ...current, [id]: !current[id] } });
  }

  async function handleUpdateInlineField(entryId, field, value) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    let parsed = value;
    if (field === 'numFish') {
      parsed = Math.max(0, Math.min(10, parseInt(value) || 0));
    } else if (field === 'lunkerWeight' || field === 'totalWeight') {
      parsed = parseFloat(value) || 0;
    } else if (field === 'boatNo') {
      parsed = String(value).trim();
    }

    try {
      const updated = await updateEntry(entryId, { ...entry, [field]: parsed });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));

      const duplicate = parsed && field === 'boatNo' && entries.some(e =>
        String(e.boatNo) === String(parsed) && e.id !== entryId
      );
      showToast(duplicate ? `Warning: Boat #${parsed} is already in use!` : 'Updated!', duplicate ? 'warning' : 'success');
    } catch {
      showToast('Failed to update', 'error');
    }
  }

  async function handleResetBoatCheck() {
    await handleUpdateSettings({ boatCheck: {}, offWater: {} });
  }

  async function handleWeighIn(entryId, weighData) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return false;
    try {
      const updated = await updateEntry(entryId, { ...entry, ...weighData });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      showToast(`Boat #${entry.boatNo} saved!`, 'success');
      return true;
    } catch {
      showToast('Failed to save weigh-in', 'error');
      return false;
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
        activeTab={isUnlocked || activeTab === 'rules' ? activeTab : 'leaderboard'}
        onTabChange={tab => { if (isUnlocked || tab === 'rules') setActiveTab(tab); }}
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
            onToggleBoatCheck={handleToggleBoatCheck}
            onToggleField={handleToggleEntryField}
            onUpdateInlineField={handleUpdateInlineField}
          />
        )}
        {activeTab === 'boatcheck' && (
          <BoatCheckTab
            entries={rankedEntries}
            settings={settings}
            isUnlocked={isUnlocked}
            onToggle={handleToggleBoatCheck}
            onToggleOffWater={handleToggleOffWater}
            onReset={handleResetBoatCheck}
          />
        )}
        {activeTab === 'weighin' && (
          <WeighInTab entries={entries} onWeighIn={handleWeighIn} />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab entries={rankedEntries} settings={settings} topN={leaderboardTopN} onTopNChange={setLeaderboardTopN} />
        )}
        {activeTab === 'rules' && <RulesTab />}
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
