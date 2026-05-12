import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import RosterTab from './components/RosterTab';
import BoatCheckTab from './components/BoatCheckTab';
import WeighInTab from './components/WeighInTab';
import LeaderboardTab from './components/LeaderboardTab';
import RulesTab from './components/RulesTab';
import SettingsTab from './components/SettingsTab';
import SignUpTab from './components/SignUpTab';
import CheckInTab from './components/CheckInTab';
import ContactsTab from './components/ContactsTab';
import ArchiveTab from './components/ArchiveTab';
import FlightsTab from './components/FlightsTab';
import EditModal from './components/EditModal';
import UnlockModal from './components/UnlockModal';
import Toast from './components/Toast';
import {
  fetchEntries, createEntry, updateEntry, deleteEntry,
  fetchSettings, saveSettings, verifyPassword, storePassword, clearPassword, isPasswordStored, revalidatePassword,
  upsertContacts, fetchContacts, updateContact, deleteContact,
  clearWeighLog, archiveEntries, backfillPhones, normalizePhones,
  clearAllEntries, createEntriesBulk,
} from './utils/api';
import { calcRanks } from './utils/calculations';

const DEFAULT_SETTINGS = {
  fees:            { entryFee: 249, lunkerFee: 10, optFee: 20, option1Pct: 70 },
  payoutSettings:  {
    totalPayout: 10500,
    numWinners:  17,
    minPayout:   255,
    payouts:     [4000,1000,800,600,500,360,350,340,330,320,295,280,275,270,265,260,255],
  },
  penalties:       { deadFishPenalty: 0.5, shortFishPenalty: 1.0, shortFishCountPenalty: 1, overLimitPenalty: 3.0, maxFish: 5 },
  boatCheck:       {},
  offWater:        {},
  recentWeighCount: 2,
  flights: [],
};

export default function App() {
  const [entries, setEntries]           = useState([]);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [theme, setTheme]               = useState(() => localStorage.getItem('ss_theme') || 'dark');
  const [activeTab, setActiveTab]       = useState(() => 'leaderboard');
  const [loading, setLoading]           = useState(true);
  const [toasts, setToasts]             = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isUnlocked, setIsUnlocked]     = useState(false);
  const [everUnlocked, setEverUnlocked] = useState(false);
  const [contacts, setContacts]         = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [buyInBlurred, setBuyInBlurred] = useState(() => localStorage.getItem('ss_buyin_blur') !== 'false');

  function handleToggleBuyInBlur() {
    const next = !buyInBlurred;
    setBuyInBlurred(next);
    localStorage.setItem('ss_buyin_blur', String(next));
  }
  const [showUnlock, setShowUnlock]     = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, { message, type, id: Date.now() + Math.random() }]);
  }, []);
  const clearToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const rankedEntries = calcRanks(entries);

  useEffect(() => {
    if (isPasswordStored()) {
      revalidatePassword().then(ok => { if (ok) setIsUnlocked(true); });
    }
  }, []);

  useEffect(() => { if (isUnlocked) setEverUnlocked(true); }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;
    setContactsLoading(true);
    fetchContacts()
      .then(data => { setContacts(data); setContactsLoading(false); })
      .catch(() => setContactsLoading(false));
  }, [isUnlocked]);

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
            penalties:      { ...DEFAULT_SETTINGS.penalties,      ...(settingsData.penalties      || {}) },
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
    document.body.classList.remove('light', 'outdoor');
    if (theme === 'light' || theme === 'outdoor') document.body.classList.add(theme);
  }, [theme]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const settingsSavePendingRef = useRef(0);

  const pollInterval = isUnlocked ? 5000 : 10000;

  useEffect(() => {
    let timer;
    async function poll() {
      if (document.hidden) return;
      try {
        const [entriesData, settingsData] = await Promise.all([fetchEntries(), fetchSettings()]);
        setEntries(prev => JSON.stringify(prev) !== JSON.stringify(entriesData) ? entriesData : prev);
        if (settingsSavePendingRef.current === 0 && settingsData && Object.keys(settingsData).length > 0) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...settingsData,
            fees:           { ...DEFAULT_SETTINGS.fees,           ...(settingsData.fees           || {}) },
            payoutSettings: { ...DEFAULT_SETTINGS.payoutSettings, ...(settingsData.payoutSettings || {}) },
            penalties:      { ...DEFAULT_SETTINGS.penalties,      ...(settingsData.penalties      || {}) },
          };
          setSettings(prev => JSON.stringify(prev) !== JSON.stringify(merged) ? merged : prev);
        }
      } catch { /* silently skip if fetch fails */ }
      if (!document.hidden) timer = setTimeout(poll, pollInterval);
    }

    function handleVisibility() {
      if (!document.hidden) {
        clearTimeout(timer);
        poll();
      } else {
        clearTimeout(timer);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) timer = setTimeout(poll, pollInterval);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pollInterval]);

  async function handleUnlock(password) {
    await verifyPassword(password);
    storePassword(password);
    setIsUnlocked(true);
    setShowUnlock(false);
  }

  function handleLock() {
    clearPassword();
    setIsUnlocked(false);
    setActiveTab(prev => (['rules', 'archive', 'leaderboard', 'flights'].includes(prev) ? prev : 'leaderboard'));
  }

  async function handleSaveEntry(entryData) {
    const duplicate = entryData.boatNo && entries.some(e =>
      String(e.boatNo) === String(entryData.boatNo) && e.id !== editingEntry?.id
    );

    if (editingEntry?.id) {
      const prevEntries = entries;
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...entryData } : e));
      setEditingEntry(null);
      showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry saved!', duplicate ? 'warning' : 'success');
      try {
        const updated = await updateEntry(editingEntry.id, entryData);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        upsertContacts([
          { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail   },
          { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail },
        ]).then(refreshContacts).catch(() => {});
      } catch {
        setEntries(prevEntries);
        setEditingEntry(editingEntry);
        showToast('Failed to save entry', 'error');
      }
    } else {
      try {
        const created = await createEntry(entryData);
        setEntries(prev => [...prev, created]);
        setEditingEntry(null);
        showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry added!', duplicate ? 'warning' : 'success');
        upsertContacts([
          { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail   },
          { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail },
        ]).then(refreshContacts).catch(() => {});
      } catch {
        showToast('Failed to save entry', 'error');
      }
    }
  }

  async function refreshContacts() {
    if (!isUnlocked) return;
    try {
      const data = await fetchContacts();
      setContacts(data);
    } catch { /* ignore */ }
  }

  async function handleDeleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    const prevEntries = entries;
    setEntries(prev => prev.filter(e => e.id !== id));
    showToast('Entry deleted', 'info');
    try {
      await deleteEntry(id);
    } catch {
      setEntries(prevEntries);
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
    settingsSavePendingRef.current += 1;
    try {
      await saveSettings(newSettings);
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      settingsSavePendingRef.current -= 1;
    }
  }

  async function handleToggleEntryField(entryId, field) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const next = (entry[field] === 1 || entry[field] === '1') ? 0 : 1;
    const prevEntries = entries;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: next } : e));
    try {
      const updated = await updateEntry(entryId, { ...entry, [field]: next });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch {
      setEntries(prevEntries);
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

    const extraClears = field === 'totalWeight' ? { rawWeight: null, deadFish: 0, shortFish: 0 } : {};
    const duplicate = parsed && field === 'boatNo' && entries.some(e =>
      String(e.boatNo) === String(parsed) && e.id !== entryId
    );
    const prevEntries = entries;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: parsed, ...extraClears } : e));
    showToast(duplicate ? `Warning: Boat #${parsed} is already in use!` : 'Updated!', duplicate ? 'warning' : 'success');
    try {
      const updated = await updateEntry(entryId, { ...entry, [field]: parsed, ...extraClears });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch {
      setEntries(prevEntries);
      showToast('Failed to update', 'error');
    }
  }

  async function handleCheckInSave(entryId, updates) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const prevEntries = entries;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updates } : e));
    showToast('Entry updated!', 'success');
    try {
      const updated = await updateEntry(entryId, { ...entry, ...updates, preserveWeighTime: true });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      upsertContacts([
        { firstName: updated.boaterFirst,   lastName: updated.boaterLast,   phone: updated.boaterPhone,   email: updated.boaterEmail   },
        { firstName: updated.coAnglerFirst, lastName: updated.coAnglerLast, phone: updated.coAnglerPhone, email: updated.coAnglerEmail },
      ]).then(refreshContacts).catch(() => {});
    } catch {
      setEntries(prevEntries);
      showToast('Failed to update entry', 'error');
    }
  }

  async function handleClearDeductions(entryId) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const prevEntries = entries;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, rawWeight: null, deadFish: 0, shortFish: 0 } : e));
    showToast('Deductions cleared', 'info');
    try {
      const updated = await updateEntry(entryId, { ...entry, rawWeight: null, deadFish: 0, shortFish: 0 });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch {
      setEntries(prevEntries);
      showToast('Failed to clear deductions', 'error');
    }
  }

  async function handleResetBoatCheck() {
    await handleUpdateSettings({ boatCheck: {}, offWater: {} });
  }

  async function handleSignUpEntry(entryData) {
    try {
      const created = await createEntry(entryData);
      setEntries(prev => [...prev, created]);
      showToast(`${entryData.boaterFirst} ${entryData.boaterLast} signed up!`, 'success');
      upsertContacts([
        { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail   },
        { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail },
      ]).then(refreshContacts).catch(() => {});
      return true;
    } catch {
      showToast('Failed to sign up entry', 'error');
      return false;
    }
  }

  async function handleAddWeighInEntry(boatNo, weighData) {
    try {
      const created = await createEntry({
        boatNo, boaterFirst: '', boaterLast: '', coAnglerFirst: '', coAnglerLast: '',
        lunker: 0, option: 0, paid: 0, appSigned: 0, buyIn: 0,
        ...weighData,
        needsAttention: true,
      });
      setEntries(prev => [...prev, created]);
      showToast(`Boat #${boatNo} added and flagged for attention`, 'warning');
      return true;
    } catch {
      showToast('Failed to add entry', 'error');
      return false;
    }
  }

  async function handleWeighIn(entryId, weighData) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return false;
    const prevEntries = entries;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...weighData } : e));
    showToast(`Boat #${entry.boatNo} saved!`, 'success');
    try {
      const updated = await updateEntry(entryId, { ...entry, ...weighData });
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      return true;
    } catch {
      setEntries(prevEntries);
      showToast('Failed to save weigh-in', 'error');
      return false;
    }
  }

  async function handleClearWeighLog() {
    const prevEntries = entries;
    setEntries(prev => prev.map(e => ({ ...e, weighedAt: null, rawWeight: null, deadFish: 0, shortFish: 0 })));
    showToast('Weigh-in log cleared', 'info');
    try {
      await clearWeighLog();
    } catch {
      setEntries(prevEntries);
      showToast('Failed to clear weigh-in log', 'error');
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear ALL data? This cannot be undone!')) return;
    try {
      await clearAllEntries();
      setEntries([]);
      await handleUpdateSettings({ boatCheck: {}, offWater: {} });
      showToast('All data cleared', 'info');
    } catch {
      showToast('Failed to clear data', 'error');
    }
  }

  async function handleArchive() {
    const year = window.prompt('Save current entries as which year?', String(new Date().getFullYear()));
    if (!year?.trim()) return;
    const label = year.trim();
    if (!confirm(`Archive ${rankedEntries.length} entries as "${label}"?\n\nAny existing archive for ${label} will be replaced.`)) return;
    try {
      const payload = rankedEntries.map(e => ({
        place:         e._rank,
        boaterFirst:   e.boaterFirst,   boaterLast:    e.boaterLast,
        boaterPhone:   e.boaterPhone,   boaterEmail:   e.boaterEmail,
        coAnglerFirst: e.coAnglerFirst, coAnglerLast:  e.coAnglerLast,
        coAnglerPhone: e.coAnglerPhone, coAnglerEmail: e.coAnglerEmail,
        boatNo:        e.boatNo,
        numFish:       e.numFish,
        lunkerWeight:  e.lunkerWeight,
        totalWeight:   e.totalWeight,
        rawWeight:     e.rawWeight,
        deadFish:      e.deadFish,
        shortFish:     e.shortFish,
        lunker:        e.lunker,        option:        e.option,
        paid:          e.paid,          appSigned:     e.appSigned,
        buyIn:         e.buyIn,
        needsAttention: e.needsAttention,
        weighedAt:     e.weighedAt,
      }));
      await archiveEntries(label, payload);
      showToast(`${rankedEntries.length} entries archived as ${label}`, 'success');
    } catch {
      showToast('Failed to archive entries', 'error');
    }
  }

  async function handleLoadArchive(archivedEntries) {
    if (entries.length > 0) {
      showToast('Clear the roster first before loading an archive', 'error');
      return;
    }
    try {
      const payload = archivedEntries.map(e => ({
        boaterFirst:   e.boaterFirst,   boaterLast:    e.boaterLast,
        boaterPhone:   e.boaterPhone,   boaterEmail:   e.boaterEmail,
        coAnglerFirst: e.coAnglerFirst, coAnglerLast:  e.coAnglerLast,
        coAnglerPhone: e.coAnglerPhone, coAnglerEmail: e.coAnglerEmail,
        boatNo:        e.boatNo,
        numFish:       e.numFish,
        lunkerWeight:  e.lunkerWeight,
        totalWeight:   e.totalWeight,
        rawWeight:     e.rawWeight,
        deadFish:      e.deadFish,
        shortFish:     e.shortFish,
        lunker:        e.lunker,        option:        e.option,
        paid:          e.paid,          appSigned:     e.appSigned,
        buyIn:         e.buyIn,
        needsAttention: e.needsAttention,
      }));
      await createEntriesBulk(payload);
      const loaded = await fetchEntries();
      setEntries(loaded);
      showToast(`Loaded ${payload.length} entries from archive — switch to Roster to edit`, 'success');
      setActiveTab('roster');
    } catch {
      showToast('Failed to load archive into roster', 'error');
    }
  }

  async function handleBackfillInfo() {
    try {
      const result = await backfillPhones();
      const refreshed = await fetchEntries();
      setEntries(refreshed);
      if (result.total === 0) {
        showToast('No matches found — entries already have info or no contact record exists', 'info');
      } else {
        const phones = (result.boaterPhoneCount || 0) + (result.coAnglerPhoneCount || 0);
        const emails = (result.boaterEmailCount || 0) + (result.coAnglerEmailCount || 0);
        const parts = [];
        if (phones) parts.push(`${phones} phone${phones !== 1 ? 's' : ''}`);
        if (emails) parts.push(`${emails} email${emails !== 1 ? 's' : ''}`);
        showToast(`Filled in: ${parts.join(', ')}`, 'success');
      }
    } catch {
      showToast('Failed to backfill info', 'error');
    }
  }

  async function handleNormalizePhones() {
    try {
      const result = await normalizePhones();
      const [refreshedEntries, refreshedContacts] = await Promise.all([fetchEntries(), fetchContacts()]);
      setEntries(refreshedEntries);
      setContacts(refreshedContacts);
      if (result.total === 0) {
        showToast('All phone numbers already formatted', 'info');
      } else {
        showToast(`Normalized ${result.total} phone number${result.total !== 1 ? 's' : ''} (${result.entriesUpdated} entries, ${result.contactsUpdated} contacts)`, 'success');
      }
    } catch (e) {
      showToast(`Normalize phones failed: ${e.message}`, 'error');
    }
  }

  async function handleImport(newEntries) {
    try {
      await createEntriesBulk(newEntries);
      const all = await fetchEntries();
      setEntries(all);
      showToast(`Imported ${newEntries.length} entries`, 'success');
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

  const settingsWithTheme = { ...settings, theme };

  return (
    <div id="app">
      <Header
        entries={rankedEntries}
        settings={settingsWithTheme}
        activeTab={isUnlocked || activeTab === 'rules' || activeTab === 'archive' || activeTab === 'roster' || activeTab === 'flights' ? activeTab : 'leaderboard'}
        onTabChange={tab => { if (isUnlocked || tab === 'rules' || tab === 'leaderboard' || tab === 'archive' || tab === 'roster' || tab === 'flights') setActiveTab(tab); }}
        onThemeToggle={() => {
          const next = theme === 'dark' ? 'light' : theme === 'light' ? 'outdoor' : 'dark';
          setTheme(next);
          localStorage.setItem('ss_theme', next);
        }}
        isUnlocked={isUnlocked}
        onToggleLock={() => isUnlocked ? handleLock() : setShowUnlock(true)}
        buyInBlurred={buyInBlurred}
        onToggleBuyInBlur={handleToggleBuyInBlur}
      />

      <main>
        {/* Public tabs — always mounted */}
        <div style={{ display: activeTab === 'roster' ? '' : 'none' }}>
          <RosterTab
            entries={rankedEntries}
            settings={settingsWithTheme}
            isUnlocked={isUnlocked}
            buyInBlurred={buyInBlurred}
            onEdit={setEditingEntry}
            onAdd={() => setEditingEntry({})}
            onDelete={handleDeleteEntry}
            onClearAll={handleClearAll}
            onImport={handleImport}
            onToggleOffWater={handleToggleOffWater}
            onToggleField={handleToggleEntryField}
            onUpdateInlineField={handleUpdateInlineField}
            onClearDeductions={handleClearDeductions}
            onArchive={handleArchive}
            onBackfillInfo={handleBackfillInfo}
            onNormalizePhones={handleNormalizePhones}
          />
        </div>
        <div style={{ display: activeTab === 'leaderboard' ? '' : 'none' }}>
          <LeaderboardTab entries={rankedEntries} settings={settingsWithTheme} />
        </div>
        <div style={{ display: activeTab === 'rules' ? '' : 'none' }}>
          <RulesTab />
        </div>
        <div style={{ display: activeTab === 'archive' ? '' : 'none' }}>
          <ArchiveTab
            isUnlocked={isUnlocked}
            rosterCount={entries.length}
            onLoadArchive={handleLoadArchive}
          />
        </div>
        <div style={{ display: activeTab === 'flights' ? '' : 'none' }}>
          <FlightsTab entries={rankedEntries} settings={settingsWithTheme} />
        </div>

        {/* Private tabs — mount once after first unlock, then stay mounted */}
        {everUnlocked && (
          <>
            <div style={{ display: activeTab === 'signup' ? '' : 'none' }}>
              <SignUpTab onAddEntry={handleSignUpEntry} />
            </div>
            <div style={{ display: activeTab === 'checkin' ? '' : 'none' }}>
              <CheckInTab entries={rankedEntries} onSave={handleCheckInSave} />
            </div>
            <div style={{ display: activeTab === 'boatcheck' ? '' : 'none' }}>
              <BoatCheckTab
                entries={rankedEntries}
                settings={settingsWithTheme}
                isUnlocked={isUnlocked}
                onToggleOffWater={handleToggleOffWater}
                onReset={handleResetBoatCheck}
              />
            </div>
            <div style={{ display: activeTab === 'weighin' ? '' : 'none' }}>
              <WeighInTab entries={entries} settings={settingsWithTheme} onWeighIn={handleWeighIn} onAddEntry={handleAddWeighInEntry} />
            </div>
            <div style={{ display: activeTab === 'contacts' ? '' : 'none' }}>
              <ContactsTab
                isUnlocked={isUnlocked}
                contacts={contacts}
                contactsLoading={contactsLoading}
                onContactsChange={setContacts}
                updateContact={updateContact}
                deleteContact={deleteContact}
              />
            </div>
            <div style={{ display: activeTab === 'settings' ? '' : 'none' }}>
              <SettingsTab
                settings={settingsWithTheme}
                entries={rankedEntries}
                isUnlocked={isUnlocked}
                onUpdateSettings={handleUpdateSettings}
                onClearAll={handleClearAll}
                onImport={handleImport}
                onClearWeighLog={handleClearWeighLog}
              />
            </div>
          </>
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

      {toasts[0] && (
        <Toast
          key={toasts[0].id}
          message={toasts[0].message}
          type={toasts[0].type}
          onDone={() => clearToast(toasts[0].id)}
        />
      )}
    </div>
  );
}
