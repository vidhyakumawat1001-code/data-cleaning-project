import { useState, useMemo } from 'react';
import { Sparkles, Trash2, Layers, Calendar, Type, Check, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { Dataset, ColumnType } from '../types';
import { detectColumnType, tryParseDate, formatDateValue, transformTextCase, analyzeColumn } from '../utils/cleaning';

interface CleaningPanelProps {
  dataset: Dataset;
  selectedColumn: string | null;
  onSelectColumn: (colName: string | null) => void;
  onApplyAction: (updatedRows: Array<Record<string, any>>, actionDescription: string, actionType: 'missing' | 'dedub' | 'date' | 'text_case' | 'category_map') => void;
}

export default function CleaningPanel({ dataset, selectedColumn, onSelectColumn, onApplyAction }: CleaningPanelProps) {
  const [activeTab, setActiveTab] = useState<'missing' | 'dedup' | 'dates' | 'text'>('missing');

  // --- TAB 1: Missing value states ---
  const [missingCol, setMissingCol] = useState<string>(selectedColumn || dataset.columns[0] || '');
  const [imputeMethod, setImputeMethod] = useState<'drop' | 'constant' | 'mean' | 'median' | 'mode' | 'empty'>('drop');
  const [constantValue, setConstantValue] = useState<string>('');

  // --- TAB 2: Deduplication states ---
  const [dedupKeys, setDedupKeys] = useState<Record<string, boolean>>({});
  const [dedupStrategy, setDedupStrategy] = useState<'first' | 'last'>('first');

  // --- TAB 3: Date formating states ---
  const [dateCol, setDateCol] = useState<string>(selectedColumn || dataset.columns[0] || '');
  const [targetDateFormat, setTargetDateFormat] = useState<string>('YYYY-MM-DD');

  // --- TAB 4: Standardize text states ---
  const [textCol, setTextCol] = useState<string>(selectedColumn || dataset.columns[0] || '');
  const [casingAction, setCasingAction] = useState<'trim' | 'lower' | 'upper' | 'title' | 'sentence'>('trim');
  
  // Custom manual mappings for categories
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});

  // Sync selectedColumn with active controls
  useMemo(() => {
    if (selectedColumn) {
      setMissingCol(selectedColumn);
      setDateCol(selectedColumn);
      setTextCol(selectedColumn);
      // Reset manual mappings when swapping column
      setCategoryMappings({});
    }
  }, [selectedColumn]);

  // Compute metrics for active columns for warning banners
  const currentMissingColMetric = useMemo(() => {
    if (!missingCol) return null;
    return analyzeColumn(missingCol, dataset.rows);
  }, [missingCol, dataset.rows]);

  const currentDateColMetric = useMemo(() => {
    if (!dateCol) return null;
    return analyzeColumn(dateCol, dataset.rows);
  }, [dateCol, dataset.rows]);

  const currentTextColMetric = useMemo(() => {
    if (!textCol) return null;
    return analyzeColumn(textCol, dataset.rows);
  }, [textCol, dataset.rows]);

  // -------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------

  // Core missing values resolver
  const handleResolveMissing = () => {
    if (!missingCol) return;
    const rows = dataset.rows.map(r => ({ ...r }));
    let updatedRows: Array<Record<string, any>> = [];
    let affectedCount = 0;
    let replacement: any = '';

    if (imputeMethod === 'drop') {
      // Filter out rows where selected column is null or whitespace
      updatedRows = rows.filter(r => {
        const val = r[missingCol];
        const isNull = val === null || val === undefined || String(val).trim() === '';
        if (isNull) affectedCount++;
        return !isNull;
      });
    } else {

      if (imputeMethod === 'constant') {
        replacement = constantValue;
      } else if (imputeMethod === 'empty') {
        replacement = '';
      } else if (imputeMethod === 'mean' || imputeMethod === 'median') {
        const numerics = rows
          .map(r => parseFloat(String(r[missingCol]).trim()))
          .filter(val => !isNaN(val));

        if (numerics.length === 0) {
          alert(`No numeric values found in [${missingCol}] to compute statistics.`);
          return;
        }

        if (imputeMethod === 'mean') {
          const sum = numerics.reduce((a, b) => a + b, 0);
          replacement = (sum / numerics.length).toFixed(2);
        } else {
          // Median
          numerics.sort((a, b) => a - b);
          const mid = Math.floor(numerics.length / 2);
          replacement = numerics.length % 2 !== 0 
            ? numerics[mid].toString()
            : ((numerics[mid - 1] + numerics[mid]) / 2).toFixed(2);
        }
      } else if (imputeMethod === 'mode') {
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let modeVal = '';
        
        rows.forEach(r => {
          const val = r[missingCol];
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            const str = String(val).trim();
            counts[str] = (counts[str] || 0) + 1;
            if (counts[str] > maxCount) {
              maxCount = counts[str];
              modeVal = str;
            }
          }
        });
        replacement = modeVal || '';
      }

      // Perform replace
      updatedRows = rows.map(r => {
        const val = r[missingCol];
        if (val === null || val === undefined || String(val).trim() === '') {
          affectedCount++;
          return { ...r, [missingCol]: replacement };
        }
        return r;
      });
    }

    const actionText = imputeMethod === 'drop'
      ? `Dropped ${affectedCount} rows containing null in [${missingCol}]`
      : `Filled ${affectedCount} missing values in [${missingCol}] with ${imputeMethod} (${replacement})`;

    onApplyAction(updatedRows, actionText, 'missing');
  };

  // Deduplication core logic
  const handleDeduplicate = () => {
    const rows = dataset.rows.map(r => ({ ...r }));
    
    // Extract key names to dedup on
    const keysToCheck = Object.entries(dedupKeys)
      .filter(([_, checked]) => checked)
      .map(([colName]) => colName);

    const matchAll = keysToCheck.length === 0;
    const seen = new Set<string>();
    const updatedRows: Array<Record<string, any>> = [];
    let dupsCount = 0;

    // Helper to generate hash to compare
    const getRowKey = (row: Record<string, any>) => {
      if (matchAll) {
        return JSON.stringify(row);
      }
      const valMap = keysToCheck.map(k => String(row[k] ?? '').trim().toLowerCase());
      return JSON.stringify(valMap);
    };

    if (dedupStrategy === 'first') {
      for (const row of rows) {
        const key = getRowKey(row);
        if (seen.has(key)) {
          dupsCount++;
        } else {
          seen.add(key);
          updatedRows.push(row);
        }
      }
    } else {
      // To keep the Last occurrence, iterate backward, keep first match, then reverse output back
      const reversedRows = [...rows].reverse();
      for (const row of reversedRows) {
        const key = getRowKey(row);
        if (seen.has(key)) {
          dupsCount++;
        } else {
          seen.add(key);
          updatedRows.push(row);
        }
      }
      updatedRows.reverse();
    }

    const colListStr = matchAll ? 'all columns' : keysToCheck.join(', ');
    const desc = `Removed ${dupsCount} duplicate records using match keys: [${colListStr}] (Retention Strategy: Keep ${dedupStrategy === 'first' ? 'First' : 'Last'} Occurrence)`;
    
    onApplyAction(updatedRows, desc, 'dedub');
  };

  // Date unifying core logic
  const handleUnifyDates = () => {
    if (!dateCol) return;
    const rows = dataset.rows.map(r => ({ ...r }));
    let updatedCount = 0;
    let failedCount = 0;

    const updatedRows = rows.map(r => {
      const val = r[dateCol];
      if (val === null || val === undefined || String(val).trim() === '') {
        return r;
      }

      const parsedDate = tryParseDate(val);
      if (parsedDate !== null) {
        updatedCount++;
        return { ...r, [dateCol]: formatDateValue(parsedDate, targetDateFormat) };
      } else {
        failedCount++;
        return r;
      }
    });

    let desc = `Standardized ${updatedCount} dates in [${dateCol}] to [${targetDateFormat}]`;
    if (failedCount > 0) {
      desc += ` (${failedCount} rows skipped because they could not be decrypted to date objects)`;
    }

    onApplyAction(updatedRows, desc, 'date');
  };

  // Text formatting core logic
  const handleStandardizeTextCasing = () => {
    if (!textCol) return;
    const rows = dataset.rows.map(r => ({ ...r }));
    let processedCount = 0;

    const updatedRows = rows.map(r => {
      const val = r[textCol];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        processedCount++;
        return { ...r, [textCol]: transformTextCase(val, casingAction) };
      }
      return r;
    });

    const desc = `Transformed values in text column [${textCol}] with '${casingAction}' conversion (affected ${processedCount} cells)`;
    onApplyAction(updatedRows, desc, 'text_case');
  };

  // Custom categorical dictionary mapper logic
  const handleApplyMappings = () => {
    if (!textCol) return;
    const rows = dataset.rows.map(r => ({ ...r }));
    let mappedCount = 0;

    const updatedRows = rows.map(r => {
      const val = r[textCol];
      const normalizedKey = (val === null || val === undefined) ? '' : String(val);
      
      if (normalizedKey in categoryMappings) {
        const replacement = categoryMappings[normalizedKey].trim();
        if (replacement !== normalizedKey) {
          mappedCount++;
          return { ...r, [textCol]: replacement };
        }
      }
      return r;
    });

    const desc = `Mapped and standardized ${mappedCount} category labels in text column [${textCol}] using mapping lookup rules`;
    onApplyAction(updatedRows, desc, 'category_map');
    setCategoryMappings({}); // clear mappings
  };

  // Suggest merges helper (fuzzy case mapping recommendation)
  const handleSuggestMerges = () => {
    if (!currentTextColMetric) return;
    
    // Group messy terms that deserve to be unified
    // Find unique labels (excluding null tag)
    const activeValues = currentTextColMetric.uniqueValuesSummary
      .map(u => u.value)
      .filter(v => v !== '(null / empty)');

    const suggested: Record<string, string> = {};

    // For each term, see if there is another term with identical clean lowercase
    // Maintain the highest-sample-count casing or the standard title case for output
    const cleanLowerGroups: Record<string, Array<{ original: string; count: number }>> = {};

    currentTextColMetric.uniqueValuesSummary.forEach(u => {
      if (u.value === '(null / empty)') return;
      const cleanLower = u.value.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!cleanLowerGroups[cleanLower]) {
        cleanLowerGroups[cleanLower] = [];
      }
      cleanLowerGroups[cleanLower].push({ original: u.value, count: u.count });
    });

    // For groups with size > 1, or groups with leading/trailing spaces or weird casings
    Object.entries(cleanLowerGroups).forEach(([cleanKey, group]) => {
      // Find the best canonical suggestion is either:
      // - The word within the group with the highest raw count
      // - Or a Title Cased standard string if all counts are 1
      group.sort((a, b) => b.count - a.count);
      const canonical = group[0].original.trim(); // Trim spaces but inherit correct spelling

      group.forEach(item => {
        // If the item needs a map (it doesn't match canonical or has dirty spaces)
        if (item.original !== canonical || item.original.trim() !== item.original) {
          suggested[item.original] = canonical;
        }
      });
    });

    setCategoryMappings(suggested);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" id="cleaning-workbench-card">
      {/* Workbench panel tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/50" id="workbench-tabs">
        <button
          onClick={() => setActiveTab('missing')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-sans font-medium text-xs transition-colors cursor-pointer border-b-2 ${
            activeTab === 'missing'
              ? 'border-indigo-500 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/30'
          }`}
          id="actions-tab-missing"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          Missing Values
        </button>
        <button
          onClick={() => setActiveTab('dedup')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-sans font-medium text-xs transition-colors cursor-pointer border-b-2 ${
            activeTab === 'dedup'
              ? 'border-indigo-500 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/30'
          }`}
          id="actions-tab-dedup"
        >
          <Layers className="w-4 h-4 shrink-0" />
          Deduplicate
        </button>
        <button
          onClick={() => setActiveTab('dates')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-sans font-medium text-xs transition-colors cursor-pointer border-b-2 ${
            activeTab === 'dates'
              ? 'border-indigo-500 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/30'
          }`}
          id="actions-tab-dates"
        >
          <Calendar className="w-4 h-4 shrink-0" />
          Fix Dates
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-sans font-medium text-xs transition-colors cursor-pointer border-b-2 ${
            activeTab === 'text'
              ? 'border-indigo-500 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/30'
          }`}
          id="actions-tab-text"
        >
          <Type className="w-4 h-4 shrink-0" />
          Text / Categories
        </button>
      </div>

      <div className="p-5">
        {/* ========================================================= */}
        {/* TAB 1: MISSING VALUES */}
        {/* ========================================================= */}
        {activeTab === 'missing' && (
          <div className="space-y-4" id="missing-panel">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Target Column</label>
                <select
                  value={missingCol}
                  onChange={(e) => {
                    setMissingCol(e.target.value);
                    onSelectColumn(e.target.value);
                  }}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                  id="missing-col-select"
                >
                  {dataset.columns.map(c => (
                    <option key={c} value={c}>Column: {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Resolution Strategy</label>
                <select
                  value={imputeMethod}
                  onChange={(e: any) => setImputeMethod(e.target.value)}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                  id="missing-impute-method"
                >
                  <option value="drop">Drop Entire Row containing null</option>
                  <option value="constant">Fill with Static Constant</option>
                  <option value="empty">Fill with Pure Empty string ("")</option>
                  <option value="mean">Compute & Fill with Metric Mean (Numeric Column)</option>
                  <option value="median">Compute & Fill with Metric Median (Numeric Column)</option>
                  <option value="mode">Compute & Fill with Mode Label (Most Common)</option>
                </select>
              </div>
            </div>

            {/* If strategy is constant, show input */}
            {imputeMethod === 'constant' && (
              <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 animate-fadeIn">
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Constant Replacement Value</label>
                <input
                  type="text"
                  value={constantValue}
                  onChange={(e) => setConstantValue(e.target.value)}
                  placeholder="e.g. N/A, 0, Unknown"
                  className="w-full max-w-sm text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                  id="missing-constant-input"
                />
              </div>
            )}

            {/* Quick Warning banners for unmatched strategies */}
            {currentMissingColMetric && (
              <div className="flex items-start gap-2 bg-slate-50 text-slate-600 p-3.5 rounded-xl border border-slate-100 text-[11px] font-sans">
                <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Column Integrity Report [{missingCol}]:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Detected major type: <strong className="uppercase">{currentMissingColMetric.type}</strong></li>
                    <li>Missing cells: <strong>{currentMissingColMetric.missingCount}</strong> ({currentMissingColMetric.fillRate}% completeness)</li>
                    {currentMissingColMetric.missingCount === 0 && (
                      <li className="text-emerald-600 font-semibold">Ready: This column was verified to have 0 empty cells!</li>
                    )}
                    {['mean', 'median'].includes(imputeMethod) && currentMissingColMetric.type !== 'numeric' && (
                      <li className="text-amber-600 font-bold">Warning: Compiling statistics (Mean/Median) on non-numeric types could result in failure.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            <button
              id="apply-resolve-missing"
              onClick={handleResolveMissing}
              disabled={currentMissingColMetric?.missingCount === 0}
              className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium font-sans text-xs px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Apply Missing values fix
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DEDUPLICATE */}
        {/* ========================================================= */}
        {activeTab === 'dedup' && (
          <div className="space-y-4" id="dedup-panel">
            <div>
              <p className="text-xs text-slate-500 mb-2 font-sans">
                Select columns to compare to identify redundant rows. If no column is checked, the system compares <strong>all column fields</strong>.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                {dataset.columns.map((c) => (
                  <label key={c} className="inline-flex items-center gap-2 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={!!dedupKeys[c]}
                      onChange={(e) => setDedupKeys({ ...dedupKeys, [c]: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-1 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-sans text-slate-700 font-medium truncate" title={c}>
                      {c}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Duplicate Retention Strategy</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <button
                  onClick={() => setDedupStrategy('first')}
                  className={`flex flex-col text-left p-3 rounded-xl border font-sans text-xs transition-all ${
                    dedupStrategy === 'first'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
                    Keep First Record
                    {dedupStrategy === 'first' && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Preserve the very first instance we encounter, purging later copies.</span>
                </button>

                <button
                  onClick={() => setDedupStrategy('last')}
                  className={`flex flex-col text-left p-3 rounded-xl border font-sans text-xs transition-all ${
                    dedupStrategy === 'last'
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
                    Keep Last Record
                    {dedupStrategy === 'last' && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Preserve latest row instance, discarding early occurrences.</span>
                </button>
              </div>
            </div>

            <button
              id="apply-deduplicate"
              onClick={handleDeduplicate}
              className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium font-sans text-xs px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Run Deduplication Engine
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: FIX DATES */}
        {/* ========================================================= */}
        {activeTab === 'dates' && (
          <div className="space-y-4" id="dates-panel">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Date Column to Fix</label>
                <select
                  value={dateCol}
                  onChange={(e) => {
                    setDateCol(e.target.value);
                    onSelectColumn(e.target.value);
                  }}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                  id="date-col-select"
                >
                  {dataset.columns.map(c => (
                    <option key={c} value={c}>Column: {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Target Unified Format</label>
                <select
                  value={targetDateFormat}
                  onChange={(e) => setTargetDateFormat(e.target.value)}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden font-mono"
                  id="target-date-format-select"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 Standard)</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (UK/India Format)</option>
                  <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                  <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
                  <option value="ISO 8601">ISO 8601 String representation</option>
                  <option value="Unix Timestamp (sec)">Unix Epoch Seconds (Numeric)</option>
                </select>
              </div>
            </div>

            {/* Date report banner */}
            {currentDateColMetric && (
              <div className="bg-slate-50 text-slate-600 p-3.5 rounded-xl border border-slate-100 text-[11px] font-sans">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700">Chronological Quality Report [{dateCol}]:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Detected type: <span className="uppercase font-semibold">{currentDateColMetric.type}</span></li>
                      {currentDateColMetric.type !== 'date' && (
                        <li className="text-amber-600 font-semibold">Note: This column's overall metadata says "{currentDateColMetric.type}". The parser will decrypt any parseable string timestamps.</li>
                      )}
                      <li>Sample raw formats inside: 
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currentDateColMetric.uniqueValuesSummary.slice(0, 3).map((u, i) => (
                            <span key={i} className="bg-white border border-slate-100 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-500 truncate" title={u.value}>
                              "{u.value}"
                            </span>
                          ))}
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <button
              id="apply-fix-dates"
              onClick={handleUnifyDates}
              className="mt-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium font-sans text-xs px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              Standardize Date Formats
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TEXT STANDARDIZATION & CATEGORIES */}
        {/* ========================================================= */}
        {activeTab === 'text' && (
          <div className="space-y-5" id="text-panel">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Target Text Column</label>
                <select
                  value={textCol}
                  onChange={(e) => {
                    setTextCol(e.target.value);
                    onSelectColumn(e.target.value);
                  }}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                  id="text-col-select"
                >
                  {dataset.columns.map(c => (
                    <option key={c} value={c}>Column: {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 font-sans mb-1.5">Casing standardizer</label>
                <div className="flex gap-2">
                  <select
                    value={casingAction}
                    onChange={(e: any) => setCasingAction(e.target.value)}
                    className="flex-1 text-xs font-sans p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                    id="text-casing-action-select"
                  >
                    <option value="trim">Collapse Spaces & Trim Only (" usa " ➜ "usa")</option>
                    <option value="lower">Convert to lowercase ("UK" ➜ "uk")</option>
                    <option value="upper">Convert to UPPERCASE ("uk" ➜ "UK")</option>
                    <option value="title">Convert to Title Case ("john doe" ➜ "John Doe")</option>
                    <option value="sentence">Convert to Sentence Case ("MARK SPENCER" ➜ "Mark spencer")</option>
                  </select>
                  <button
                    id="apply-text-casing"
                    onClick={handleStandardizeTextCasing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg text-xs font-sans font-medium flex items-center justify-center cursor-pointer transition-colors px-3 shrink-0"
                  >
                    Apply Case
                  </button>
                </div>
              </div>
            </div>

            {/* Categorical labels norm editor */}
            {currentTextColMetric && (
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100" id="category-mapping-engine">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h5 className="font-semibold text-xs font-sans text-slate-800">
                      Categorical Standardization Dictionary
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                      Standardize distinct synonyms or casings to unify your groups (e.g., merging "uk", "uk " into "UK").
                    </p>
                  </div>
                  <button
                    onClick={handleSuggestMerges}
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                    id="auto-cluster-merges"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Auto-Cluster Merges
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1" id="mapping-list-box">
                  {currentTextColMetric.uniqueValuesSummary
                    .filter(u => u.value !== '(null / empty)')
                    .map((item) => {
                      const sampleCount = item.count;
                      const rawVal = item.value;
                      const activeMap = categoryMappings[rawVal] !== undefined ? categoryMappings[rawVal] : rawVal;

                      return (
                        <div key={rawVal} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-100/80 group">
                          <div className="flex items-center gap-2 max-w-sm truncate">
                            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm line-clamp-1 select-all" title={rawVal}>
                              "{rawVal}"
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans shrink-0">
                              ({sampleCount} occurrences)
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 font-sans">
                            <span className="text-[10px] text-slate-400 font-sans">➜ Map to:</span>
                            <input
                              type="text"
                              value={categoryMappings[rawVal] !== undefined ? categoryMappings[rawVal] : ''}
                              onChange={(e) => {
                                setCategoryMappings({ ...categoryMappings, [rawVal]: e.target.value });
                              }}
                              placeholder={rawVal}
                              className="text-xs p-1 px-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 w-full sm:w-40 font-sans focus:outline-hidden"
                            />
                            {categoryMappings[rawVal] !== undefined && (
                              <button
                                onClick={() => {
                                  const cloned = { ...categoryMappings };
                                  delete cloned[rawVal];
                                  setCategoryMappings(cloned);
                                }}
                                className="text-[10px] text-rose-500 hover:underline font-serif px-1 cursor-pointer"
                              >
                                clear
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {currentTextColMetric.uniqueValuesSummary.filter(u => u.value !== '(null / empty)').length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 font-sans">No text categories to map.</div>
                  )}
                </div>

                {Object.keys(categoryMappings).length > 0 && (
                  <div className="mt-3.5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => setCategoryMappings({})}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline font-semibold font-sans px-3 py-1 cursor-pointer"
                    >
                      Reset Changes
                    </button>
                    <button
                      onClick={handleApplyMappings}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium font-sans text-xs px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      id="save-categorical-mappings"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply Dictionary Mapping
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
