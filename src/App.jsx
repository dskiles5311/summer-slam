import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import RosterTab from './components/RosterTab';
import BoatCheckTab from './components/BoatCheckTab';
import WeighInTab from './components/WeighInTab';
import LeaderboardTab from './components/LeaderboardTab';
import RulesTab from './components/RulesTab';
import OffLimitsTab from './components/OffLimitsTab';
import SettingsTab from './components/SettingsTab';
import SignUpTab from './components/SignUpTab';
import CheckInTab from './components/CheckInTab';
import ContactsTab from './components/ContactsTab';
import ArchiveTab from './components/ArchiveTab';
import FlightsTab from './components/FlightsTab';
import EditModal from './components/EditModal';
import UnlockModal from './components/UnlockModal';
import Toast from './components/Toast';
import { verifyPassword, storePassword, clearPassword, isPasswordStored, revalidatePassword, archiveEntries } from './utils/api';
import { calcRanks } from './utils/calculations';
import { useEntries, useCreateEntry, useUpdateEntry, useDeleteEntry, useClearWeighLog, useClearSignUpLog, useClearCheckInLog, useClearCheckOutLog, useClearAllEntries, useCreateEntriesBulk, useBackfillPhones, useNormalizePhones } from './hooks/useEntries';
import { useSettings, useSaveSettings } from './hooks/useSettings';
import { useContacts, useUpdateContact, useDeleteContact, useUpsertContacts } from './hooks/useContacts';

const DEFAULT_SETTINGS = {
  fees:            { entryFee: 249, lunkerFee: 10, optFee: 20, option1Pct: 70 },
  payoutSettings:  {
    totalPayout: 10500,
    numWinners:  17,
    minPayout:   255,
    payouts:     [4000,1000,800,600,500,360,350,340,330,320,295,280,275,270,265,260,255],
  },
  penalties:       { deadFishPenalty: 0.5, shortFishPenalty: 1.0, shortFishCountPenalty: 1, overLimitPenalty: 3.0, maxFish: 5, minFishLength: 15, latePenaltyPerMin: 1.0, latePenaltyDQMin: 15 },
  boatCheck:       {},
  offWater:        {},
  recentWeighCount: 2,
  flights: [],
};

function mergeSettings(raw) {
  if (!raw || !Object.keys(raw).length) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    fees:           { ...DEFAULT_SETTINGS.fees,           ...(raw.fees           || {}) },
    payoutSettings: { ...DEFAULT_SETTINGS.payoutSettings, ...(raw.payoutSettings || {}) },
    penalties:      { ...DEFAULT_SETTINGS.penalties,      ...(raw.penalties      || {}) },
  };
}

export default function App() {
  const [theme, setTheme]               = useState(() => localStorage.getItem('ss_theme') || 'light');
  const [activeTab, setActiveTab]       = useState('leaderboard');
  const [toasts, setToasts]             = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isUnlocked, setIsUnlocked]     = useState(false);
  const [everUnlocked, setEverUnlocked] = useState(false);
  const [showUnlock, setShowUnlock]     = useState(false);
  const [buyInBlurred, setBuyInBlurred] = useState(() => localStorage.getItem('ss_buyin_blur') !== 'false');

  const showToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, { message, type, id: Date.now() + Math.random() }]);
  }, []);
  const clearToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pollInterval = isUnlocked ? 5000 : 10000;

  // --- Queries ---
  const entriesQuery  = useEntries({ refetchInterval: pollInterval });
  const settingsQuery = useSettings({ refetchInterval: pollInterval });
  const contactsQuery = useContacts({ enabled: isUnlocked });

  const rawEntries = entriesQuery.data  || [];
  const settings   = useMemo(() => mergeSettings(settingsQuery.data), [settingsQuery.data]);
  const contacts   = contactsQuery.data || [];

  const rankedEntries = useMemo(() => calcRanks(rawEntries, settings), [rawEntries, settings]);

  // --- Mutations ---
  const createEntryMut    = useCreateEntry();
  const updateEntryMut    = useUpdateEntry();
  const deleteEntryMut    = useDeleteEntry();
  const clearWeighLogMut    = useClearWeighLog();
  const clearSignUpLogMut   = useClearSignUpLog();
  const clearCheckInLogMut  = useClearCheckInLog();
  const clearCheckOutLogMut = useClearCheckOutLog();
  const clearAllMut       = useClearAllEntries();
  const bulkCreateMut     = useCreateEntriesBulk();
  const backfillMut       = useBackfillPhones();
  const normalizePhonesMut = useNormalizePhones();
  const saveSettingsMut   = useSaveSettings();
  const updateContactMut  = useUpdateContact();
  const deleteContactMut  = useDeleteContact();
  const upsertContactsMut = useUpsertContacts();

  // --- Auth ---
  useEffect(() => {
    if (isPasswordStored()) {
      revalidatePassword().then(ok => { if (ok) setIsUnlocked(true); });
    }
  }, []);

  useEffect(() => { if (isUnlocked) setEverUnlocked(true); }, [isUnlocked]);

  useEffect(() => {
    document.body.classList.remove('light');
    if (theme === 'light') document.body.classList.add(theme);
  }, [theme]);

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

  function handleToggleBuyInBlur() {
    const next = !buyInBlurred;
    setBuyInBlurred(next);
    localStorage.setItem('ss_buyin_blur', String(next));
  }

  // --- Settings ---
  async function handleUpdateSettings(updates) {
    const newSettings = {
      ...settings,
      ...updates,
      fees:           updates.fees           ? { ...settings.fees,           ...updates.fees           } : settings.fees,
      payoutSettings: updates.payoutSettings ? { ...settings.payoutSettings, ...updates.payoutSettings } : settings.payoutSettings,
    };
    saveSettingsMut.mutate(newSettings, {
      onError: () => showToast('Failed to save settings', 'error'),
    });
  }

  // --- Entries ---
  async function handleSaveEntry(entryData) {
    const duplicate = entryData.boatNo && rawEntries.some(e =>
      String(e.boatNo) === String(entryData.boatNo) && e.id !== editingEntry?.id
    );

    if (editingEntry?.id) {
      const prev = editingEntry;
      setEditingEntry(null);
      showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry saved!', duplicate ? 'warning' : 'success');
      updateEntryMut.mutate({ id: prev.id, data: entryData }, {
        onSuccess: () => {
          upsertContactsMut.mutate([
            { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail,
              ...(prev.boaterFirst !== entryData.boaterFirst || prev.boaterLast !== entryData.boaterLast
                ? { oldFirstName: prev.boaterFirst, oldLastName: prev.boaterLast } : {}) },
            { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail,
              ...(prev.coAnglerFirst !== entryData.coAnglerFirst || prev.coAnglerLast !== entryData.coAnglerLast
                ? { oldFirstName: prev.coAnglerFirst, oldLastName: prev.coAnglerLast } : {}) },
          ]);
        },
        onError: (err) => {
          setEditingEntry(prev);
          showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to save entry', 'error');
        },
      });
    } else {
      try {
        await createEntryMut.mutateAsync(entryData);
        setEditingEntry(null);
        showToast(duplicate ? `Warning: Boat #${entryData.boatNo} is already in use!` : 'Entry added!', duplicate ? 'warning' : 'success');
        upsertContactsMut.mutate([
          { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail   },
          { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail },
        ]);
      } catch {
        showToast('Failed to save entry', 'error');
      }
    }
  }

  async function handleDeleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    showToast('Entry deleted', 'info');
    deleteEntryMut.mutate(id, {
      onError: () => showToast('Failed to delete entry', 'error'),
    });
  }

  async function handleToggleEntryField(entryId, field) {
    const entry = rawEntries.find(e => e.id === entryId);
    if (!entry) return;
    const next = (entry[field] === 1 || entry[field] === '1') ? 0 : 1;
    updateEntryMut.mutate({ id: entryId, data: { ...entry, [field]: next } }, {
      onError: (err) => showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to update', 'error'),
    });
  }

  async function handleUpdateInlineField(entryId, field, value) {
    const entry = rawEntries.find(e => e.id === entryId);
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
    const duplicate = parsed && field === 'boatNo' && rawEntries.some(e =>
      String(e.boatNo) === String(parsed) && e.id !== entryId
    );
    showToast(duplicate ? `Warning: Boat #${parsed} is already in use!` : 'Updated!', duplicate ? 'warning' : 'success');
    updateEntryMut.mutate({ id: entryId, data: { ...entry, [field]: parsed, ...extraClears } }, {
      onError: (err) => showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to update', 'error'),
    });
  }

  async function handleCheckInSave(entryId, updates) {
    const entry = rawEntries.find(e => e.id === entryId);
    if (!entry) return;
    showToast('Entry updated!', 'success');
    updateEntryMut.mutate({ id: entryId, data: { ...entry, ...updates, preserveWeighTime: true } }, {
      onSuccess: (updated) => {
        upsertContactsMut.mutate([
          { firstName: updated.boaterFirst,   lastName: updated.boaterLast,   phone: updated.boaterPhone,   email: updated.boaterEmail,
            ...(entry.boaterFirst !== updated.boaterFirst || entry.boaterLast !== updated.boaterLast
              ? { oldFirstName: entry.boaterFirst, oldLastName: entry.boaterLast } : {}) },
          { firstName: updated.coAnglerFirst, lastName: updated.coAnglerLast, phone: updated.coAnglerPhone, email: updated.coAnglerEmail,
            ...(entry.coAnglerFirst !== updated.coAnglerFirst || entry.coAnglerLast !== updated.coAnglerLast
              ? { oldFirstName: entry.coAnglerFirst, oldLastName: entry.coAnglerLast } : {}) },
        ]);
      },
      onError: (err) => showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to update entry', 'error'),
    });
  }

  async function handleClearDeductions(entryId) {
    const entry = rawEntries.find(e => e.id === entryId);
    if (!entry) return;
    showToast('Deductions cleared', 'info');
    updateEntryMut.mutate({ id: entryId, data: { ...entry, rawWeight: null, deadFish: 0, shortFish: 0 } }, {
      onError: (err) => showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to clear deductions', 'error'),
    });
  }

  async function handleWeighIn(entryId, weighData) {
    const entry = rawEntries.find(e => e.id === entryId);
    if (!entry) return false;
    try {
      await updateEntryMut.mutateAsync({ id: entryId, data: { ...entry, ...weighData } });
      showToast(`Boat #${entry.boatNo} saved!`, 'success');
      return true;
    } catch (err) {
      showToast(err.isConflict ? 'This entry was modified by another device — your changes were not saved.' : 'Failed to save weigh-in', 'error');
      return false;
    }
  }

  async function handleSignUpEntry(entryData) {
    try {
      await createEntryMut.mutateAsync(entryData);
      showToast(`${entryData.boaterFirst} ${entryData.boaterLast} signed up!`, 'success');
      upsertContactsMut.mutate([
        { firstName: entryData.boaterFirst,   lastName: entryData.boaterLast,   phone: entryData.boaterPhone,   email: entryData.boaterEmail,   contactId: entryData.boaterContactId   ?? null },
        { firstName: entryData.coAnglerFirst, lastName: entryData.coAnglerLast, phone: entryData.coAnglerPhone, email: entryData.coAnglerEmail, contactId: entryData.coAnglerContactId ?? null },
      ]);
      return true;
    } catch {
      showToast('Failed to sign up entry', 'error');
      return false;
    }
  }

  async function handleAddWeighInEntry(boatNo, weighData) {
    try {
      await createEntryMut.mutateAsync({
        boatNo, boaterFirst: '', boaterLast: '', coAnglerFirst: '', coAnglerLast: '',
        lunker: 0, option: 0, paid: 0, appSigned: 0, buyIn: 0,
        ...weighData,
        needsAttention: true,
      });
      showToast(`Boat #${boatNo} added and flagged for attention`, 'warning');
      return true;
    } catch {
      showToast('Failed to add entry', 'error');
      return false;
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
    const nowOffWater = !current[id];
    await handleUpdateSettings({ offWater: { ...current, [id]: nowOffWater } });
    const entry = rawEntries.find(e => e.id === id);
    if (entry) {
      updateEntryMut.mutate({ id, data: { ...entry, offWater: nowOffWater } });
    }
  }

  async function handleResetBoatCheck() {
    await handleUpdateSettings({ boatCheck: {}, offWater: {} });
  }

  async function handleClearWeighLog() {
    showToast('Weigh-in log cleared', 'info');
    clearWeighLogMut.mutate(undefined, {
      onError: () => showToast('Failed to clear weigh-in log', 'error'),
    });
  }

  async function handleClearSignUpLog() {
    showToast('Sign-up log cleared', 'info');
    clearSignUpLogMut.mutate(undefined, {
      onError: () => showToast('Failed to clear sign-up log', 'error'),
    });
  }

  async function handleClearCheckInLog() {
    showToast('Check-in log cleared', 'info');
    clearCheckInLogMut.mutate(undefined, {
      onError: () => showToast('Failed to clear check-in log', 'error'),
    });
  }

  async function handleClearCheckOutLog() {
    showToast('Check-out log cleared', 'info');
    clearCheckOutLogMut.mutate(undefined, {
      onError: () => showToast('Failed to clear check-out log', 'error'),
    });
  }

  async function handleClearAll() {
    if (!confirm('Clear ALL data? This cannot be undone!')) return;
    try {
      await clearAllMut.mutateAsync();
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
    if (!/^\d{4}$/.test(label)) { alert('Year must be a 4-digit number (e.g. 2025).'); return; }
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
        weighedAt:    e.weighedAt,
        signedUpAt:   e.signedUpAt,
        checkedInAt:  e.checkedInAt,
        offWaterAt:   e.offWaterAt,
      }));
      await archiveEntries(label, payload);
      showToast(`${rankedEntries.length} entries archived as ${label}`, 'success');
    } catch {
      showToast('Failed to archive entries', 'error');
    }
  }

  async function handleLoadArchive(archivedEntries) {
    if (rawEntries.length > 0) {
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
        weighedAt:     e.weighedAt     ?? null,
        signedUpAt:    e.signedUpAt    ?? null,
        checkedInAt:   e.checkedInAt   ?? null,
        offWaterAt:    e.offWaterAt    ?? null,
      }));
      await bulkCreateMut.mutateAsync(payload);
      showToast(`Loaded ${payload.length} entries from archive — switch to Roster to edit`, 'success');
      setActiveTab('roster');
    } catch {
      showToast('Failed to load archive into roster', 'error');
    }
  }

  async function handleBackfillInfo() {
    try {
      const result = await backfillMut.mutateAsync();
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
      const result = await normalizePhonesMut.mutateAsync();
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
      await bulkCreateMut.mutateAsync(newEntries);
      showToast(`Imported ${newEntries.length} entries`, 'success');
    } catch {
      showToast('Import failed', 'error');
    }
  }

  const isInitialLoading = entriesQuery.isLoading || settingsQuery.isLoading;

  if (isInitialLoading) {
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
        activeTab={isUnlocked || activeTab === 'rules' || activeTab === 'offlimits' || activeTab === 'archive' || activeTab === 'roster' || activeTab === 'flights' ? activeTab : 'leaderboard'}
        onTabChange={tab => { if (isUnlocked || tab === 'rules' || tab === 'offlimits' || tab === 'leaderboard' || tab === 'archive' || tab === 'roster' || tab === 'flights') setActiveTab(tab); }}
        onThemeToggle={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          localStorage.setItem('ss_theme', next);
        }}
        isUnlocked={isUnlocked}
        onToggleLock={() => isUnlocked ? handleLock() : setShowUnlock(true)}
        buyInBlurred={buyInBlurred}
        onToggleBuyInBlur={handleToggleBuyInBlur}
      />

      {activeTab === 'leaderboard' && (
        <img
          src="/watermark.png"
          alt=""
          aria-hidden="true"
          className="lb-watermark"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80vmin',
            height: '80vmin',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}

      <main>
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
          <RulesTab settings={settings} />
        </div>
        <div style={{ display: activeTab === 'offlimits' ? '' : 'none' }}>
          <OffLimitsTab settings={settings} />
        </div>
        <div style={{ display: activeTab === 'archive' ? '' : 'none' }}>
          <ArchiveTab
            isUnlocked={isUnlocked}
            rosterCount={rawEntries.length}
            onLoadArchive={handleLoadArchive}
          />
        </div>
        <div style={{ display: activeTab === 'flights' ? '' : 'none' }}>
          <FlightsTab entries={rankedEntries} settings={settingsWithTheme} />
        </div>

        {everUnlocked && (
          <>
            <div style={{ display: activeTab === 'signup' ? '' : 'none' }}>
              <SignUpTab onAddEntry={handleSignUpEntry} settings={settingsWithTheme} />
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
              <WeighInTab entries={rawEntries} settings={settingsWithTheme} onWeighIn={handleWeighIn} onAddEntry={handleAddWeighInEntry} />
            </div>
            <div style={{ display: activeTab === 'contacts' ? '' : 'none' }}>
              <ContactsTab
                isUnlocked={isUnlocked}
                contacts={contacts}
                contactsLoading={contactsQuery.isLoading}
                onContactsChange={() => {}}
                updateContact={(id, data) => updateContactMut.mutateAsync({ id, data })}
                deleteContact={(id) => deleteContactMut.mutateAsync(id)}
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
                onClearSignUpLog={handleClearSignUpLog}
                onClearCheckInLog={handleClearCheckInLog}
                onClearCheckOutLog={handleClearCheckOutLog}
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
          settings={settingsWithTheme}
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
