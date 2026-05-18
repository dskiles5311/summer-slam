export default function FlightsTab({ entries, settings }) {
  const flights = (settings.flights || []).slice().sort(
    (a, b) => (parseInt(a.boatStart) || 0) - (parseInt(b.boatStart) || 0)
  );

  const sorted = [...entries].sort((a, b) => {
    const na = parseInt(a.boatNo);
    const nb = parseInt(b.boatNo);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a.boatNo || '').localeCompare(String(b.boatNo || ''));
  });

  function findFlightIdx(boatNo) {
    const n = parseInt(boatNo);
    if (isNaN(n)) return -1;
    return flights.findIndex(
      f => n >= (parseInt(f.boatStart) || 0) && (!f.boatEnd || n <= parseInt(f.boatEnd))
    );
  }

  const groups = flights.map(f => ({ flight: f, entries: [] }));
  const unassigned = [];

  for (const entry of sorted) {
    const idx = findFlightIdx(entry.boatNo);
    if (idx === -1) unassigned.push(entry);
    else groups[idx].entries.push(entry);
  }

  // Numeric boat numbers outside all defined ranges go into the last flight
  if (groups.length > 0) {
    const overflow = unassigned.filter(e => !isNaN(parseInt(e.boatNo)));
    groups[groups.length - 1].entries.push(...overflow);
  }

  if (flights.length === 0) {
    return (
      <div className="tab-panel active">
        <div className="toolbar">
          <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>Flights</h2>
        </div>
        <div style={{ maxWidth: 700, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎣</div>
          <p style={{ color: 'var(--header-bg)', fontSize: 15 }}>
            No flights have been configured yet.
          </p>
          <p style={{ color: 'var(--header-bg)', fontSize: 13, marginTop: 8, opacity: 0.75 }}>
            Unlock the app and go to <strong style={{ color: 'var(--gold-light)' }}>Settings → Flight Schedule</strong> to add flights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>Flights</h2>
        <span style={{ fontSize: 12, color: 'var(--header-bg)' }}>
          {entries.length} boat{entries.length !== 1 ? 's' : ''} · sorted by boat #
        </span>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', paddingTop: 8 }}>
        {groups.map(({ flight, entries: flightEntries }, gIdx) => (
          <div key={gIdx} style={{ marginBottom: 24 }}>
            <FlightDivider flight={flight} flightNum={gIdx + 1} count={flightEntries.length} isLast={gIdx === groups.length - 1} />
            {flightEntries.length === 0 ? (
              <p style={{ color: 'var(--header-bg)', fontSize: 13, padding: '10px 4px', fontStyle: 'italic' }}>
                No boats in this flight range yet.
              </p>
            ) : (
              <div>
                {flightEntries.map(entry => <BoatRow key={entry.id} entry={entry} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlightDivider({ flight, flightNum, count, isLast }) {
  return (
    <div style={{
      background: 'rgba(200,169,106,0.12)',
      border: '1px solid rgba(200,169,106,0.35)',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: 'var(--gold-light)', fontSize: 16 }}>
          Flight {flightNum}
          <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--header-bg)', marginLeft: 10 }}>
            {isLast ? `Boats #${flight.boatStart}+ (remaining)` : `Boats #${flight.boatStart}–#${flight.boatEnd}`}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--header-bg)', marginTop: 3, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {flight.launchTime  && <span>🚤 Launch: <strong style={{ color: 'var(--white)' }}>{flight.launchTime}</strong></span>}
          {flight.checkInTime && <span>📋 Check-In: <strong style={{ color: 'var(--white)' }}>{flight.checkInTime}</strong></span>}
        </div>
      </div>
      <div style={{ fontWeight: 700, color: 'var(--header-bg)', fontSize: 13, flexShrink: 0 }}>
        {count} boat{count !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function BoatRow({ entry }) {
  const boater   = [entry.boaterFirst, entry.boaterLast  ].filter(Boolean).join(' ') || '—';
  const coAngler = [entry.coAnglerFirst, entry.coAnglerLast].filter(Boolean).join(' ');

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '56px 1fr',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      borderRadius: 8,
      marginBottom: 6,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(139,180,225,0.12)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--header-bg)', lineHeight: 1 }}>
          {entry.boatNo || '—'}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--header-bg)', opacity: 0.7, marginTop: 2 }}>
          Boat #
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 15, lineHeight: 1.3 }}>
          {boater}
          {coAngler && (
            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--header-bg)', marginLeft: 8 }}>
              / {coAngler}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
