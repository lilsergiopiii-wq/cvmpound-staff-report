import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const hourlyTimes = ['5AM', '6AM', '7AM', '8AM', '9AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'];
const hourlyTasks = [
  'Wipe Down All Equipment',
  'Rack All Weights',
  'Reset Cable Attachments',
  'Face Dumbbells',
  'Reposition Sleds and Boxes',
  'Clean Chalk',
  'Wipe Down/Restock Restrooms',
  'Refresh Towels',
  'Organize & Restock Merch',
  'Lounge Seating Wipe Down',
  'Check/Clean Toilets',
  'Check/Clean Bathroom All Bathroom Mirrors',
  'Wipe Bathroom Counters/Dust Rogue Shelves',
  'Check/Clean Lounge Doors',
  'Check/Clean Gym/Posing Room Mirrors',
  'Vacuum Lounge Carpet Strip',
  'Inspect/Vacuum Under All Machines',
  'Locker Wipedown',
  'Front Door Wipe Down/Spot Mop Lobby',
  'Refold Clothing',
  'Bev Wipe Down/Drain/Restock',
  'Sauna Wipedown (Glass/Floor)',
  'Wipe Down Machine Guide Rails Using Silicon Grease',
  'Break Down/Take Out Empty Boxes in Office'
];

const sixHourTimes = ['11AM', '5PM', '11PM'];
const sixHourTasks = [
  'Refill Spray Bottles',
  'Fill Sanitizer',
  'Dust Window Panes',
  'Vacuum Turf',
  'Discard Items on Back Rack'
];

const openingTasks = ['Shelf Merch Lights', 'Turn on TVs', 'Turn on Mirror Lights', 'Refresh Towels'];
const closingTasks = ['Shelf Merch Lights', 'Turn Off TVs', 'Turn Off Mirror Lights', 'Lock Back/Lounge Door'];
const reminderTasks = ['Check Aromaplan Scents', 'Check Cold Plunge Basin', 'Check if Cold Plunges Needed to be Drained'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeGrid(tasks, times, checked = false) {
  return Object.fromEntries(tasks.map((task) => [task, Object.fromEntries(times.map((time) => [time, checked]))]));
}

function makeList(tasks, checked = false) {
  return Object.fromEntries(tasks.map((task) => [task, checked]));
}

function createBlankReport(date = todayISO()) {
  return {
    date,
    hourlyTimes,
    hourlyTasks,
    hourlyChecks: makeGrid(hourlyTasks, hourlyTimes),
    sixHourTimes,
    sixHourTasks,
    sixHourChecks: makeGrid(sixHourTasks, sixHourTimes),
    openingTasks,
    opening: makeList(openingTasks),
    closingTasks,
    closing: makeList(closingTasks),
    reminderTasks,
    reminders: makeList(reminderTasks),
    itemsOrdered: '',
    notes: '',
    signoffs: { am: '', mid: '', pm: '' },
    locked: false,
    submittedAt: null
  };
}

function draftKey(date) {
  return `cvmpound-staff-report-draft-${date}`;
}

function cls(...classes) {
  return classes.filter(Boolean).join(' ');
}

function Checkbox({ checked, disabled, onChange, label }) {
  return (
    <label className="checkbox-wrap" title={label || ''}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer accent-black disabled:cursor-not-allowed"
        aria-label={label}
      />
    </label>
  );
}

function SectionHeader({ title, onCheckAll, onUncheckAll, locked }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 print:mb-1">
      <h2 className="form-section-title">{title}</h2>
      <div className="flex gap-2 print:hidden">
        <button type="button" disabled={locked} onClick={onCheckAll} className="small-button">Check All</button>
        <button type="button" disabled={locked} onClick={onUncheckAll} className="small-button muted">Uncheck All</button>
      </div>
    </div>
  );
}

function HourlyGrid({ report, setReport }) {
  const locked = report.locked;
  const setCell = (task, time, value) => {
    setReport((prev) => ({
      ...prev,
      hourlyChecks: {
        ...prev.hourlyChecks,
        [task]: { ...prev.hourlyChecks[task], [time]: value }
      }
    }));
  };
  const fill = (value) => setReport((prev) => ({ ...prev, hourlyChecks: makeGrid(hourlyTasks, hourlyTimes, value) }));
  const toggleHourlyColumn = (time) => {
    setReport((prev) => {
      const allChecked = hourlyTasks.every((task) => Boolean(prev.hourlyChecks?.[task]?.[time]));
      const nextValue = !allChecked;
      const nextHourlyChecks = { ...prev.hourlyChecks };
      for (const task of hourlyTasks) {
        nextHourlyChecks[task] = { ...nextHourlyChecks[task], [time]: nextValue };
      }
      return { ...prev, hourlyChecks: nextHourlyChecks };
    });
  };

  return (
    <section className="section-card">
      <SectionHeader title="Hourly Checks" onCheckAll={() => fill(true)} onUncheckAll={() => fill(false)} locked={locked} />
      <div className="overflow-x-auto border border-gray-500 print:overflow-visible">
        <table className="compact-table w-full min-w-[1060px] border-collapse text-xs print:min-w-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[320px] border border-gray-500 bg-white p-1.5 text-left print:static">Task</th>
              {hourlyTimes.map((time) => {
                const isPM = ['12PM', '2PM', '4PM', '6PM', '8PM', '10PM'].includes(time);
                return (
                  <th
                    key={time}
                    className={cls('border border-gray-500 p-1 text-center font-bold', isPM ? 'pm-col' : 'am-col', !locked && 'header-time-clickable')}
                    onClick={locked ? undefined : () => toggleHourlyColumn(time)}
                    title={locked ? `${time}` : `Toggle all ${time} checks`}
                  >
                    <span className="time-header-label">{time}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hourlyTasks.map((task) => (
              <tr key={task}>
                <td className="sticky left-0 z-10 border border-gray-500 bg-white p-1.5 font-medium print:static">{task}</td>
                {hourlyTimes.map((time) => {
                  const isPM = ['12PM', '2PM', '4PM', '6PM', '8PM', '10PM'].includes(time);
                  return (
                    <td key={`${task}-${time}`} className={cls('border border-gray-500 text-center', isPM ? 'pm-col' : 'am-col')}>
                      <Checkbox checked={report.hourlyChecks?.[task]?.[time]} disabled={locked} onChange={(value) => setCell(task, time, value)} label={`${task} ${time}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SixHourGrid({ report, setReport }) {
  const locked = report.locked;
  const setCell = (task, time, value) => {
    setReport((prev) => ({
      ...prev,
      sixHourChecks: {
        ...prev.sixHourChecks,
        [task]: { ...prev.sixHourChecks[task], [time]: value }
      }
    }));
  };
  const fill = (value) => setReport((prev) => ({ ...prev, sixHourChecks: makeGrid(sixHourTasks, sixHourTimes, value) }));
  const toggleSixHourColumn = (time) => {
    setReport((prev) => {
      const allChecked = sixHourTasks.every((task) => Boolean(prev.sixHourChecks?.[task]?.[time]));
      const nextValue = !allChecked;
      const nextSixHourChecks = { ...prev.sixHourChecks };
      for (const task of sixHourTasks) {
        nextSixHourChecks[task] = { ...nextSixHourChecks[task], [time]: nextValue };
      }
      return { ...prev, sixHourChecks: nextSixHourChecks };
    });
  };

  return (
    <section className="section-card">
      <SectionHeader title="6-Hour Checks" onCheckAll={() => fill(true)} onUncheckAll={() => fill(false)} locked={locked} />
      <div className="overflow-x-auto border border-gray-500">
        <table className="compact-table w-full min-w-[520px] border-collapse text-xs print:min-w-0">
          <thead>
            <tr>
              <th className="border border-gray-500 bg-white p-1.5 text-left">Task</th>
              {sixHourTimes.map((time) => {
                return (
                  <th
                    key={time}
                    className={cls('border border-gray-500 p-1 text-center font-bold', ['5PM', '11PM'].includes(time) ? 'pm-col' : 'am-col', !locked && 'header-time-clickable')}
                    onClick={locked ? undefined : () => toggleSixHourColumn(time)}
                    title={locked ? `${time}` : `Toggle all ${time} checks`}
                  >
                    <span className="time-header-label">{time}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sixHourTasks.map((task, index) => (
              <tr key={task}>
                <td className={cls('border border-gray-500 p-1.5 font-medium', index % 2 ? 'bg-gray-50' : 'bg-white')}>{task}</td>
                {sixHourTimes.map((time) => (
                  <td key={`${task}-${time}`} className={cls('border border-gray-500 text-center', ['5PM', '11PM'].includes(time) ? 'pm-col' : 'am-col')}>
                    <Checkbox checked={report.sixHourChecks?.[task]?.[time]} disabled={locked} onChange={(value) => setCell(task, time, value)} label={`${task} ${time}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChecklistSection({ title, tasks, values, stateKey, report, setReport }) {
  const locked = report.locked;
  const fill = (value) => setReport((prev) => ({ ...prev, [stateKey]: makeList(tasks, value) }));
  const setTask = (task, value) => setReport((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [task]: value } }));

  return (
    <section className="section-card">
      <SectionHeader title={title} onCheckAll={() => fill(true)} onUncheckAll={() => fill(false)} locked={locked} />
      <div className="space-y-0">
        {tasks.map((task) => (
          <div key={task} className="flex min-w-0 max-w-full items-center justify-between gap-2 border border-gray-500 bg-white px-2 py-1 even:bg-gray-50">
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-black">{task}</span>
            <Checkbox checked={values?.[task]} disabled={locked} onChange={(value) => setTask(task, value)} label={task} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RemindersSection({ report, setReport }) {
  const locked = report.locked;
  const fill = (value) => setReport((prev) => ({ ...prev, reminders: makeList(reminderTasks, value) }));
  const setTask = (task, value) => setReport((prev) => ({ ...prev, reminders: { ...prev.reminders, [task]: value } }));

  return (
    <section className="section-card">
      <SectionHeader title="Reminders" onCheckAll={() => fill(true)} onUncheckAll={() => fill(false)} locked={locked} />
      <div className="overflow-hidden border border-gray-500">
        <table className="compact-table w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-500 bg-white p-1.5 text-left">Reminder</th>
              <th className="w-24 border border-gray-500 bg-white p-1 text-center">Done</th>
            </tr>
          </thead>
          <tbody>
            {reminderTasks.map((task, index) => (
              <tr key={task}>
                <td className={cls('border border-gray-500 p-1.5 font-medium', index % 2 ? 'bg-gray-50' : 'bg-white')}>{task}</td>
                <td className={cls('border border-gray-500 text-center', index % 2 ? 'bg-gray-50' : 'bg-white')}>
                  <Checkbox checked={report.reminders?.[task]} disabled={locked} onChange={(value) => setTask(task, value)} label={task} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TextAreasAndSignoffs({ report, setReport }) {
  const locked = report.locked;
  const setField = (field, value) => setReport((prev) => ({ ...prev, [field]: value }));
  const setSignoff = (field, value) => setReport((prev) => ({ ...prev, signoffs: { ...prev.signoffs, [field]: value } }));

  return (
    <section className="grid grid-cols-1 gap-3 print:gap-2">
      <div className="section-card">
        <h2 className="form-section-title">Items Ordered</h2>
        <textarea disabled={locked} value={report.itemsOrdered} onChange={(event) => setField('itemsOrdered', event.target.value)} className="field min-h-28 print:min-h-20" placeholder="" />
      </div>
      <div className="section-card">
        <h2 className="form-section-title">Notes</h2>
        <textarea disabled={locked} value={report.notes} onChange={(event) => setField('notes', event.target.value)} className="field min-h-28 print:min-h-20" placeholder="" />
      </div>
      <div className="section-card">
        <h2 className="form-section-title">Shift Sign-Offs</h2>
        <div className="grid grid-cols-1 gap-2 print:gap-2">
          <label className="block min-w-0"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-black">AM Shift</span><input disabled={locked} value={report.signoffs.am} onChange={(event) => setSignoff('am', event.target.value)} className="field min-w-0" placeholder="Typed name" /></label>
          <label className="block min-w-0"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-black">Mid Shift</span><input disabled={locked} value={report.signoffs.mid} onChange={(event) => setSignoff('mid', event.target.value)} className="field min-w-0" placeholder="Typed name" /></label>
          <label className="block min-w-0"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-black">PM Shift</span><input disabled={locked} value={report.signoffs.pm} onChange={(event) => setSignoff('pm', event.target.value)} className="field min-w-0" placeholder="Typed name" /></label>
        </div>
      </div>
    </section>
  );
}

const WEIGHT_PLATE_COLUMNS = ['2.5', '5', '10', '25', '35', '45'];

function weightDistributionRow(machine, category, w25, w5, w10, w25p, w35, w45) {
  return {
    machine,
    category,
    plates: { '2.5': w25, '5': w5, '10': w10, '25': w25p, '35': w35, '45': w45 }
  };
}

const WEIGHT_DISTRIBUTION_CATEGORY_ORDER = ['Legs', 'Chest', 'Shoulders', 'Arms', 'Back'];

const WEIGHT_DISTRIBUTION_ROWS = [
  weightDistributionRow('Atlantis Pendulum Squat', 'Legs', 0, 0, 0, 2, 0, 4),
  weightDistributionRow('Watson Power Squat', 'Legs', 0, 0, 0, 2, 2, 6),
  weightDistributionRow('Atlantis Hack Squat', 'Legs', 0, 0, 0, 4, 4, 8),
  weightDistributionRow('Cybex Smith Machine', 'Legs', 0, 4, 4, 4, 4, 2),
  weightDistributionRow('Atlantis Belt Squat', 'Legs', 0, 0, 4, 4, 0, 4),
  weightDistributionRow('Atlantis Leg Press', 'Legs', 0, 0, 0, 2, 4, 10),
  weightDistributionRow('Cybex Leg Press', 'Legs', 0, 0, 0, 2, 4, 8),
  weightDistributionRow('Prime Leg Extension', 'Legs', 0, 0, 0, 0, 0, 3),
  weightDistributionRow('Atlantis Glute Drive', 'Legs', 0, 0, 0, 4, 4, 4),
  weightDistributionRow('Prime Rouge Tree', 'Legs', 2, 2, 2, 2, 0, 0),
  weightDistributionRow('Precor Glute Bench', 'Legs', 0, 0, 0, 0, 0, 6),
  weightDistributionRow('Watson Seated Calf Press', 'Legs', 0, 0, 4, 2, 2, 2),
  weightDistributionRow('Atlantis Incline Fly', 'Chest', 0, 0, 4, 4, 4, 4),
  weightDistributionRow('Atlantis Incline Bench', 'Chest', 0, 0, 0, 2, 2, 6),
  weightDistributionRow('Atlantis Decline Flat Bench', 'Chest', 0, 0, 2, 2, 2, 4),
  weightDistributionRow('Atlantis Seated Chest Press', 'Chest', 0, 0, 4, 4, 4, 4),
  weightDistributionRow('Prime Flat Chest Press', 'Chest', 0, 0, 2, 2, 2, 4),
  weightDistributionRow('Prime Incline Chest Press', 'Chest', 0, 0, 2, 2, 2, 4),
  weightDistributionRow('Atlantis Seated Shoulder Press', 'Shoulders', 0, 0, 2, 2, 2, 2),
  weightDistributionRow('Atlantis Viking Press', 'Shoulders', 0, 0, 2, 2, 2, 4),
  weightDistributionRow('Watson Delt Builder', 'Shoulders', 0, 0, 0, 0, 0, 4),
  weightDistributionRow('Atlantis Seated Tricep Pressdown', 'Arms', 0, 0, 2, 2, 0, 4),
  weightDistributionRow('Cybex Arm Curl', 'Arms', 0, 0, 4, 2, 0, 0),
  weightDistributionRow('Atlantis Seal Row', 'Back', 0, 0, 4, 4, 4, 4),
  weightDistributionRow('MegaMass Lat Pulldown', 'Back', 0, 0, 0, 0, 0, 4),
  weightDistributionRow('Atlantis Lat Pulldown', 'Back', 0, 0, 4, 4, 4, 4),
  weightDistributionRow('Prime Extreme Row', 'Back', 0, 0, 0, 2, 0, 4),
  weightDistributionRow('Prime Seated Row', 'Back', 0, 0, 0, 0, 0, 2)
];

/** All plate columns tied for the highest non-zero count in this row. */
function maxPlateColumns(plates) {
  let max = 0;
  for (const col of WEIGHT_PLATE_COLUMNS) {
    const value = plates[col];
    if (value > max) max = value;
  }
  if (max <= 0) return new Set();
  return new Set(WEIGHT_PLATE_COLUMNS.filter((col) => plates[col] === max));
}

function WeightDistributionModal({ open, onClose }) {
  if (!open) return null;

  const tableRows = [];
  for (const category of WEIGHT_DISTRIBUTION_CATEGORY_ORDER) {
    const categoryRows = WEIGHT_DISTRIBUTION_ROWS.filter((row) => row.category === category);
    if (!categoryRows.length) continue;
    tableRows.push({ type: 'header', category });
    for (const row of categoryRows) {
      tableRows.push({ type: 'data', ...row });
    }
  }

  const columnCount = 1 + WEIGHT_PLATE_COLUMNS.length;
  let dataRowIndex = 0;
  const gridBorder = 'border border-[#ccc]';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white print:hidden" role="dialog" aria-modal="true" aria-labelledby="weight-distribution-title">
      <div className="flex shrink-0 items-center justify-between border-b-2 border-black px-4 py-3">
        <h2 id="weight-distribution-title" className="text-sm font-bold uppercase tracking-wide text-black">Weight Distribution</h2>
        <button type="button" onClick={onClose} className="main-button secondary min-h-10 min-w-10 justify-center px-2" aria-label="Close">X</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className={cls('overflow-x-auto', gridBorder)}>
          <table className="compact-table w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr>
                <th className={cls(gridBorder, 'bg-white p-2 text-left font-bold uppercase tracking-wide')}>Machine</th>
                {WEIGHT_PLATE_COLUMNS.map((col) => (
                  <th key={col} className={cls(gridBorder, 'bg-white p-2 text-center font-bold')}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((entry, index) => {
                if (entry.type === 'header') {
                  return (
                    <tr key={`cat-${entry.category}`}>
                      <td
                        colSpan={columnCount}
                        className={cls(
                          gridBorder,
                          'bg-black px-2 py-4 text-[15px] font-bold uppercase leading-snug tracking-wide text-white md:text-base'
                        )}
                      >
                        {entry.category}
                      </td>
                    </tr>
                  );
                }
                const stripeBg = dataRowIndex % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]';
                dataRowIndex += 1;
                const maxCols = maxPlateColumns(entry.plates);

                return (
                  <tr key={`${entry.machine}-${index}`}>
                    <td className={cls(gridBorder, 'p-2 font-medium text-black', stripeBg)}>
                      {entry.machine}
                    </td>
                    {WEIGHT_PLATE_COLUMNS.map((col) => {
                      const value = entry.plates[col];
                      const isZero = value === 0;
                      const isMax = maxCols.has(col);
                      return (
                        <td
                          key={col}
                          className={cls(
                            gridBorder,
                            'p-2 text-center text-base',
                            stripeBg,
                            isMax && 'border-2 border-[#333] font-bold text-black',
                            !isMax && isZero && 'text-gray-400',
                            !isMax && !isZero && 'font-bold text-black'
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportHistory({ onLoadReport }) {
  const [date, setDate] = useState(todayISO());
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState('');

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/reports`);
      if (!response.ok) throw new Error('Unable to load history.');
      setReports(await response.json());
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const loadByDate = async () => {
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/reports/${date}`);
      if (!response.ok) throw new Error('No submitted report found for that date.');
      const loaded = await response.json();
      onLoadReport(loaded);
      setMessage(`Loaded submitted report for ${date}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section className="section-card print:hidden">
      <div className="mb-2 flex items-center gap-2"><h2 className="form-section-title mb-0">Report History</h2></div>
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field max-w-52" />
        <button type="button" onClick={loadByDate} className="main-button secondary">Load Report</button>
        <button type="button" onClick={refreshHistory} className="main-button secondary">Refresh History</button>
      </div>
      {message && <p className="mt-2 text-sm text-black">{message}</p>}
      {reports.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-black">
          {reports.slice(0, 10).map((item) => (
            <button key={item.date} type="button" onClick={() => { setDate(item.date); onLoadReport(null, item.date); }} className="rounded border border-gray-500 px-3 py-1 hover:bg-gray-100">{item.date}</button>
          ))}
        </div>
      )}
    </section>
  );
}

function App() {
  const reportCaptureRef = useRef(null);
  const [report, setReport] = useState(() => {
    const today = todayISO();
    const saved = localStorage.getItem(draftKey(today));
    return saved ? JSON.parse(saved) : createBlankReport(today);
  });
  const [lastSaved, setLastSaved] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  /** True after loading a report from Report History; skips autosave so local drafts (esp. today) are not overwritten. */
  const [viewingLoadedHistoryReport, setViewingLoadedHistoryReport] = useState(false);
  const [weightDistributionOpen, setWeightDistributionOpen] = useState(false);

  const completion = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const task of hourlyTasks) for (const time of hourlyTimes) { total += 1; if (report.hourlyChecks?.[task]?.[time]) done += 1; }
    for (const task of sixHourTasks) for (const time of sixHourTimes) { total += 1; if (report.sixHourChecks?.[task]?.[time]) done += 1; }
    for (const task of openingTasks) { total += 1; if (report.opening?.[task]) done += 1; }
    for (const task of closingTasks) { total += 1; if (report.closing?.[task]) done += 1; }
    for (const task of reminderTasks) { total += 1; if (report.reminders?.[task]) done += 1; }
    return Math.round((done / total) * 100);
  }, [report]);

  const saveDraft = useCallback((target = report) => {
    if (viewingLoadedHistoryReport) {
      setDirty(false);
      return;
    }
    localStorage.setItem(draftKey(target.date), JSON.stringify(target));
    setLastSaved(new Date());
    setDirty(false);
  }, [report, viewingLoadedHistoryReport]);

  useEffect(() => { setDirty(true); saveDraft(report); }, [report, saveDraft]);
  useEffect(() => { const interval = window.setInterval(() => saveDraft(report), 30000); return () => window.clearInterval(interval); }, [report, saveDraft]);
  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const updateDate = (newDate) => {
    setViewingLoadedHistoryReport(false);
    const saved = localStorage.getItem(draftKey(newDate));
    if (saved) setReport(JSON.parse(saved));
    else setReport(createBlankReport(newDate));
  };

  const fillEverything = (value) => setReport((prev) => ({
    ...prev,
    hourlyChecks: makeGrid(hourlyTasks, hourlyTimes, value),
    sixHourChecks: makeGrid(sixHourTasks, sixHourTimes, value),
    opening: makeList(openingTasks, value),
    closing: makeList(closingTasks, value),
    reminders: makeList(reminderTasks, value)
  }));

  const resetDraft = () => {
    if (!window.confirm('Reset this report back to blank?')) return;
    setViewingLoadedHistoryReport(false);
    const blank = createBlankReport(report.date);
    localStorage.setItem(draftKey(report.date), JSON.stringify(blank));
    setReport(blank);
  };

  const unlockReportForEditing = () => {
    const confirmed = window.confirm('This report has already been submitted. Do you want to unlock it for editing?');
    if (!confirmed) return;
    setViewingLoadedHistoryReport(false);
    setReport((prev) => ({ ...prev, locked: false }));
    setStatus('Report unlocked for editing.');
  };

  const startNewBlankReport = () => {
    if (!window.confirm('Start a new blank report for this date?')) return;
    setViewingLoadedHistoryReport(false);
    const blank = createBlankReport(report.date);
    localStorage.setItem(draftKey(report.date), JSON.stringify(blank));
    setReport(blank);
    setStatus('Started new blank report.');
  };

  const submitReport = async () => {
    if (report.locked) return;
    if (!window.confirm('Are you sure you want to submit the report?')) return;
    const finalReport = { ...report, locked: true, submittedAt: new Date().toISOString() };
    setStatus('Submitting report...');
    try {
      let screenshotBlob = null;
      if (reportCaptureRef.current) {
        try {
          const { default: html2canvas } = await import('html2canvas');
          const el = reportCaptureRef.current;
          const prevScrollX = window.scrollX;
          const prevScrollY = window.scrollY;
          window.scrollTo(0, 0);
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          });
          try {
            const tw = el.scrollWidth;
            const th = el.scrollHeight;
            const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0,
              windowWidth: tw,
              windowHeight: th,
              width: tw,
              height: th,
              onclone(clonedDoc) {
                clonedDoc.querySelectorAll('.cvmpound-logo').forEach((node) => {
                  if (!(node instanceof HTMLElement)) return;
                  node.style.setProperty('filter', 'brightness(0)');
                  node.style.setProperty('-webkit-filter', 'brightness(0)');
                });
              }
            });
            screenshotBlob = await new Promise((resolve) => {
              canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
            });
          } finally {
            window.scrollTo(prevScrollX, prevScrollY);
          }
        } catch {
          /* Screenshot is optional; submission continues without it. */
        }
      }
      const form = new FormData();
      form.append('report', JSON.stringify(finalReport));
      if (screenshotBlob) form.append('reportScreenshot', screenshotBlob, `staff-report-${finalReport.date}.png`);
      const response = await fetch(`${API_URL}/api/reports`, { method: 'POST', body: form });
      if (!response.ok) throw new Error('Submit failed. Check that the backend is running.');
      const data = await response.json();
      const submitted = { ...data.report, locked: false };
      setViewingLoadedHistoryReport(false);
      setReport(submitted);
      saveDraft(submitted);
      setStatus(data.slack?.attempted && data.slack?.ok === false ? data.slack.message : 'Submitted.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const loadHistory = async (loadedReport, dateFromButton) => {
    if (loadedReport) {
      setViewingLoadedHistoryReport(true);
      setReport(loadedReport);
      return;
    }
    if (dateFromButton) {
      try {
        const response = await fetch(`${API_URL}/api/reports/${dateFromButton}`);
        if (response.ok) {
          setViewingLoadedHistoryReport(true);
          setReport(await response.json());
        }
      } catch { setStatus('Unable to load that report.'); }
    }
  };

  const returnToTodaysReport = () => {
    setViewingLoadedHistoryReport(false);
    const today = todayISO();
    const saved = localStorage.getItem(draftKey(today));
    setReport(saved ? JSON.parse(saved) : createBlankReport(today));
    setStatus('');
  };

  return (
    <main className="app-shell min-h-screen bg-[#f5f5f5] px-2 py-3 text-black md:px-4 print:bg-white print:p-2">
      <div ref={reportCaptureRef} className="app-container">
      <header className="app-panel mb-3 border-2 border-black bg-white p-3 print:mb-2 print:border print:p-2">
        <div className="header-row">
          <div className="header-logo-area">
            <img src="/cvmpound-logo.webp" alt="CVMPOUND Logo" className="cvmpound-logo" />
          </div>
          <div className="header-title-area">
            <div className="text-2xl font-black uppercase tracking-wide">STAFF REPORT</div>
          </div>
          <div className="header-date-area">
            <label className="inline-block">
              <span className="mr-2 text-xs font-bold uppercase tracking-wide">Date:</span>
              <input type="date" value={report.date} disabled={report.locked} onChange={(event) => updateDate(event.target.value)} className="field inline-block max-w-40" />
            </label>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide">Completion: {completion}%</div>
          </div>
        </div>
        <div className="mt-3 flex w-full flex-wrap items-center gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {viewingLoadedHistoryReport && (
              <button type="button" onClick={returnToTodaysReport} className="main-button secondary">{"Back to Today's Report"}</button>
            )}
            <button type="button" disabled={report.locked} onClick={() => saveDraft(report)} className="main-button secondary">Save Draft</button>
            <button type="button" disabled={report.locked} onClick={() => fillEverything(true)} className="main-button">Check All</button>
            <button type="button" disabled={report.locked} onClick={() => fillEverything(false)} className="main-button secondary">Uncheck All</button>
            {report.locked ? (
              <button type="button" onClick={unlockReportForEditing} className="main-button secondary">Edit Report</button>
            ) : (
              <button type="button" onClick={submitReport} className="main-button danger">Submit Report</button>
            )}
            <button type="button" onClick={() => window.print()} className="main-button secondary">Print Report</button>
            <button type="button" disabled={report.locked} onClick={resetDraft} className="main-button secondary">Reset Draft</button>
            {!report.locked && (
              <button type="button" onClick={startNewBlankReport} className="main-button secondary">New Blank Report</button>
            )}
          </div>
          <button type="button" onClick={() => setWeightDistributionOpen(true)} className="main-button secondary ml-auto shrink-0">Weight Distribution</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-black print:hidden">
          <span>Last saved: {lastSaved ? lastSaved.toLocaleTimeString() : 'Not saved yet'}</span>
          {report.submittedAt && <span className="rounded border border-black px-3 py-1 font-bold">{report.locked ? 'Locked after submit' : 'Last submitted'}: {new Date(report.submittedAt).toLocaleString()}</span>}
          {status && <span className="font-medium">{status}</span>}
        </div>
      </header>
      <div className="app-content space-y-3 print:space-y-2">
        <HourlyGrid report={report} setReport={setReport} />
        <div className="grid gap-3 lg:grid-cols-2 print:grid-cols-2 print:gap-2"><ChecklistSection title="Opening Checks" tasks={openingTasks} values={report.opening} stateKey="opening" report={report} setReport={setReport} /><ChecklistSection title="Closing Checks" tasks={closingTasks} values={report.closing} stateKey="closing" report={report} setReport={setReport} /></div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr] print:grid-cols-2 print:gap-2"><SixHourGrid report={report} setReport={setReport} /><RemindersSection report={report} setReport={setReport} /></div>
        <TextAreasAndSignoffs report={report} setReport={setReport} />
        <ReportHistory onLoadReport={loadHistory} />
      </div>
      </div>
      <WeightDistributionModal open={weightDistributionOpen} onClose={() => setWeightDistributionOpen(false)} />
    </main>
  );
}

function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (username === 'cvmpound' && password === 'staff2026!$') {
      setError('');
      onSuccess();
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <main className="app-shell flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-6 text-black">
      <form onSubmit={handleSubmit} className="w-full max-w-md border-2 border-black bg-white p-6">
        <h1 className="mb-6 text-center text-xl font-black uppercase tracking-wide">CVMPOUND Staff Report</h1>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-black">Username</span>
          <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} className="field" autoComplete="username" />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-black">Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" autoComplete="current-password" />
        </label>
        {error && <p className="mb-3 text-sm font-medium text-black">{error}</p>}
        <button type="submit" className="main-button w-full justify-center">Login</button>
      </form>
    </main>
  );
}

function Root() {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
