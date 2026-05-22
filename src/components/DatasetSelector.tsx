import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Database, Clipboard, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { Dataset } from '../types';
import { mockDatasets } from '../data/mockDatasets';

interface DatasetSelectorProps {
  onDatasetSelected: (dataset: Dataset) => void;
  currentDatasetName: string;
}

export default function DatasetSelector({ onDatasetSelected, currentDatasetName }: DatasetSelectorProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'paste'>('presets');
  const [pastedText, setPastedText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = (preset: Dataset) => {
    // Clone preset to avoid modifying original mock data
    const clonedRows = preset.rows.map(row => ({ ...row }));
    onDatasetSelected({
      name: preset.name,
      columns: [...preset.columns],
      rows: clonedRows
    });
  };

  const processCSVText = (text: string, sourceName: string) => {
    try {
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false // Retain raw string representation to clean properly
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error(parsed.errors[0].message || "Invalid CSV format");
      }

      if (parsed.data.length === 0) {
        throw new Error("No data found or columns are missing.");
      }

      // Safeguard: Extract keys to populate columns
      const cols = parsed.meta.fields || Object.keys(parsed.data[0]);

      onDatasetSelected({
        name: sourceName,
        columns: cols,
        rows: parsed.data
      });
      return true;
    } catch (err: any) {
      setPasteError(err.message || 'Error parsing CSV');
      return false;
    }
  };

  const processJSONText = (text: string, sourceName: string) => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        throw new Error('JSON data must be an array of objects.');
      }
      if (data.length === 0) {
        throw new Error('JSON array is empty.');
      }
      
      const cols = Object.keys(data[0]);
      onDatasetSelected({
        name: sourceName,
        columns: cols,
        rows: data
      });
      return true;
    } catch (err: any) {
      setPasteError(`Invalid JSON: ${err.message}`);
      return false;
    }
  };

  const handlePasteSubmit = () => {
    setPasteError(null);
    const text = pastedText.trim();
    if (!text) {
      setPasteError('Please paste some text first.');
      return;
    }

    if (text.startsWith('[') || text.startsWith('{')) {
      // It's JSON
      if (processJSONText(text, "Pasted JSON Dataset")) {
        setPastedText('');
      }
    } else {
      // It's CSV
      if (processCSVText(text, "Pasted CSV Dataset")) {
        setPastedText('');
      }
    }
  };

  const handleFileUpload = (file: File) => {
    setPasteError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      if (file.name.endsWith('.json')) {
        processJSONText(text, file.name);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.tsv')) {
        processCSVText(text, file.name);
      } else {
        // Fallback guess: try CSV first, then JSON
        try {
          if (text.startsWith('[') || text.trim().startsWith('{')) {
            processJSONText(text, file.name);
          } else {
            processCSVText(text, file.name);
          }
        } catch (err) {
          setPasteError('Unsupported file type or unparseable content.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" id="dataset-selector-card">
      {/* Tabs list */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 gap-1">
        <button
          id="tab-presets"
          onClick={() => { setActiveTab('presets'); setPasteError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'presets'
              ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-500" />
          Preloaded Messy Data
        </button>
        <button
          id="tab-upload"
          onClick={() => { setActiveTab('upload'); setPasteError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'upload'
              ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Upload className="w-4 h-4 text-emerald-500" />
          Upload CSV / JSON
        </button>
        <button
          id="tab-paste"
          onClick={() => { setActiveTab('paste'); setPasteError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'paste'
              ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Clipboard className="w-4 h-4 text-amber-500" />
          Paste Data
        </button>
      </div>

      <div className="p-5">
        {/* Presets content */}
        {activeTab === 'presets' && (
          <div>
            <p className="text-xs text-slate-500 mb-4 font-sans leading-relaxed">
              Experience the engine instantly by selecting one of these realistic "dirty" datasets, pre-packed with duplicate records, null entries, messy casing offsets, and mixed date styles.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {mockDatasets.map((dataset) => {
                const isSelected = currentDatasetName === dataset.name;
                return (
                  <button
                    key={dataset.name}
                    id={`preset-${dataset.name.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => handleSelectPreset(dataset)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 justify-between w-full">
                      <span className={`font-medium text-xs font-sans ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {dataset.name.replace(" (Messy)", "")}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                      ) : (
                        <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {dataset.rows.length} rows
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {dataset.columns.length} columns
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload content */}
        {activeTab === 'upload' && (
          <div
            id="drag-and-drop-container"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/30'
                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.json,.txt,.tsv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className={`p-3 rounded-full mb-3 ${dragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-slate-700 font-sans">
              Drag & drop your CSV or JSON file here, or <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Supports .csv, .json, .txt, .tsv files
            </p>
          </div>
        )}

        {/* Paste raw content */}
        {activeTab === 'paste' && (
          <div className="flex flex-col gap-3">
            <textarea
              id="raw-data-textarea"
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder='Paste comma-separated text or JSON array here...&#10;For example (CSV):&#10;name,email,signup_date&#10;john doe,john.doe@gmail.com,2023-01-15&#10;  Jane Smith,jane.smith@example.com,15/01/2023'
              className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden resize-y placeholder-slate-400"
            />
            <button
              id="submit-pasted-data"
              onClick={handlePasteSubmit}
              className="self-end inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium font-sans text-xs px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Analyze Data
            </button>
          </div>
        )}

        {/* Error Notification */}
        {pasteError && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 text-xs font-sans" id="selector-error-banner">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Parsing Failed</p>
              <p className="text-[11px] opacity-90 mt-0.5">{pasteError}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
