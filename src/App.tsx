import { useState, useMemo } from 'react';
import { Database, Download, Sparkles, Check, Info, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';

import { ColumnType, Dataset, CleaningStep, DataQualitySummary } from './types';
import { mockDatasets } from './data/mockDatasets';
import { calculateQualityMetrics, detectColumnType } from './utils/cleaning';

// Component imports
import DatasetSelector from './components/DatasetSelector';
import DataStats from './components/DataStats';
import CleaningPanel from './components/CleaningPanel';
import ColumnDetails from './components/ColumnDetails';
import DataTable from './components/DataTable';
import HistoryPanel from './components/HistoryPanel';

export default function App() {
  // Load first messy mock dataset as starting state
  const initialPreset = mockDatasets[0];
  const [dataset, setDataset] = useState<Dataset>({
    name: initialPreset.name,
    columns: [...initialPreset.columns],
    rows: initialPreset.rows.map(r => ({ ...r }))
  });

  // Track state history for robust visual UNDO pipeline
  const [history, setHistory] = useState<Array<{ dataset: Dataset; step: CleaningStep }>>([]);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  // Compute stats on active sheet
  const metrics = useMemo(() => {
    return calculateQualityMetrics(dataset);
  }, [dataset]);

  // Clean steps representation
  const appliedSteps = useMemo(() => {
    return history.map(h => h.step);
  }, [history]);

  // --- ACTIONS ---

  // Standard step applicator
  const handleApplyAction = (
    updatedRows: Array<Record<string, any>>,
    description: string,
    actionType: 'missing' | 'dedub' | 'date' | 'text_case' | 'category_map'
  ) => {
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const countDifference = Math.abs(dataset.rows.length - updatedRows.length);

    const step: CleaningStep = {
      id: crypto.randomUUID(),
      description,
      actionType,
      targetColumn: selectedColumn || undefined,
      timestamp: timestampStr,
      affectedRows: countDifference || dataset.rows.length
    };

    // Push snapshot to history stack
    setHistory([...history, { dataset: { ...dataset, rows: dataset.rows.map(r => ({ ...r })) }, step }]);
    
    // Update active dataset
    setDataset({
      ...dataset,
      rows: updatedRows
    });
  };

  const handleDatasetSelected = (newDataset: Dataset) => {
    // Completely clear history and swap active sheets
    setHistory([]);
    setSelectedColumn(null);
    setDataset(newDataset);
  };

  // Undo last snapshot
  const handleUndo = () => {
    if (history.length === 0) return;
    const historyCopy = [...history];
    const previousState = historyCopy.pop();
    if (previousState) {
      setDataset(previousState.dataset);
      setHistory(historyCopy);
    }
  };

  // Completely revert to root pre-load state
  const handleReset = () => {
    if (history.length === 0) return;
    // The very first element in history contains the root snapshot
    const rootState = history[0].dataset;
    setDataset({
      name: rootState.name,
      columns: [...rootState.columns],
      rows: rootState.rows.map(r => ({ ...r }))
    });
    setHistory([]);
    setSelectedColumn(null);
  };

  // Download fully structured CSV
  const handleDownloadCSV = () => {
    try {
      const csvStr = Papa.unparse(dataset.rows);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.setAttribute('href', url);
      
      const cleanFileName = dataset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_cleansed.csv';
      downloadLink.setAttribute('download', cleanFileName);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (err) {
      alert('Error compiling CSV document.');
    }
  };

  // Download fully structured JSON
  const handleDownloadJSON = () => {
    try {
      const jsonStr = JSON.stringify(dataset.rows, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.setAttribute('href', url);
      
      const cleanFileName = dataset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_cleansed.json';
      downloadLink.setAttribute('download', cleanFileName);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (err) {
      alert('Error compiling JSON document.');
    }
  };

  // Quick Action: Deduplicate (automatically compares all columns, keep first)
  const handleQuickDedup = () => {
    const seen = new Set<string>();
    const originalRows = dataset.rows.map(r => ({ ...r }));
    const uniqueRows: Array<Record<string, any>> = [];
    let dupsCount = 0;

    for (const r of originalRows) {
      const rowKey = JSON.stringify(r);
      if (seen.has(rowKey)) {
        dupsCount++;
      } else {
        seen.add(rowKey);
        uniqueRows.push(r);
      }
    }

    if (dupsCount === 0) {
      alert("No full-row duplicates detected!");
      return;
    }

    handleApplyAction(
      uniqueRows,
      `Removed ${dupsCount} fully identical duplicate row(s) from dataset.`,
      'dedub'
    );
  };

  // Quick Action: Impute empty rows with defaults
  const handleQuickImpute = () => {
    // For each column, find missing values of text/numeric type and fill with appropriate defaults
    const cols = dataset.columns;
    const originalRows = dataset.rows.map(r => ({ ...r }));
    let replacementsCount = 0;

    const colTypes = cols.reduce((acc, col) => {
      acc[col] = detectColumnType(dataset.rows.map(r => r[col]));
      return acc;
    }, {} as Record<string, ColumnType>);

    const updatedRows = originalRows.map(row => {
      const rowCopy = { ...row };
      cols.forEach(col => {
        const val = rowCopy[col];
        if (val === null || val === undefined || String(val).trim() === '') {
          replacementsCount++;
          // Fill default based on detected type
          const type = colTypes[col];
          if (type === 'numeric') {
            rowCopy[col] = '0';
          } else if (type === 'date') {
            rowCopy[col] = new Date().toISOString().split('T')[0];
          } else if (type === 'boolean') {
            rowCopy[col] = 'false';
          } else {
            rowCopy[col] = 'N/A';
          }
        }
      });
      return rowCopy;
    });

    handleApplyAction(
      updatedRows,
      `Quick filled ${replacementsCount} missing cell(s) with standard fallback markers (dates to today, numeric to 0, text to N/A).`,
      'missing'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 selection:bg-indigo-500 selection:text-white" id="main-application-frame">
      {/* Header section */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10" id="global-application-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md cursor-default flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-lg text-slate-950 tracking-tight flex items-center gap-2">
                Data Cleanser & Standardizer
                <span className="inline-flex bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-sans font-bold text-[10px] uppercase select-none border border-indigo-100">
                  v1.2 Studio
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-sans mt-0.5 leading-none">
                Transform dirty client worksheets, csv logs, & sensor outputs into highly optimized datasets in real-time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-sans">
            <span className="text-xs text-slate-400">Target File:</span>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg truncate max-w-sm font-mono leading-none">
              {dataset.name}
            </span>
          </div>
        </div>
      </header>

      {/* Main body canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" id="primary-etl-canvas">
        {/* Load & Selection Stage */}
        <DatasetSelector
          onDatasetSelected={handleDatasetSelected}
          currentDatasetName={dataset.name}
        />

        {/* Analytical Health Overview Metrics row */}
        <DataStats
          metrics={metrics}
          dataset={dataset}
          onQuickDedup={handleQuickDedup}
          onQuickFillNulls={handleQuickImpute}
        />

        {/* Cleaning Workspace panel & Column Details inspector split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="workbench-inspector-split">
          <div className="lg:col-span-2">
            <CleaningPanel
              dataset={dataset}
              selectedColumn={selectedColumn}
              onSelectColumn={setSelectedColumn}
              onApplyAction={handleApplyAction}
            />
          </div>
          <div>
            <ColumnDetails
              dataset={dataset}
              selectedColumn={selectedColumn}
              onSelectColumn={setSelectedColumn}
            />
          </div>
        </div>

        {/* Paginated live preview dataset grid */}
        <DataTable
          dataset={dataset}
          selectedColumn={selectedColumn}
          onSelectColumn={setSelectedColumn}
        />

        {/* Applied Recipe timeline & Download center */}
        <HistoryPanel
          steps={appliedSteps}
          onUndo={handleUndo}
          onReset={handleReset}
          onDownloadCSV={handleDownloadCSV}
          onDownloadJSON={handleDownloadJSON}
        />
      </main>

      {/* Status Footer */}
      <footer className="border-t border-slate-100 bg-white py-6" id="application-credits-footer">
        <div className="max-w-7xl mx-auto px-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center text-slate-400 text-xs gap-3">
          <p className="font-sans">
            Standardizer operates 100% locally in your sandboxed browser environment — preserving raw privacy.
          </p>
          <p className="font-mono text-[11px] opacity-80">
            Secure browser offline data processing engine
          </p>
        </div>
      </footer>
    </div>
  );
}
