import { RotateCcw, CornerUpLeft, Clock, Download, FileJson, CheckCircle } from 'lucide-react';
import { CleaningStep, Dataset } from '../types';

interface HistoryPanelProps {
  steps: CleaningStep[];
  onUndo: () => void;
  onReset: () => void;
  onDownloadCSV: () => void;
  onDownloadJSON: () => void;
}

export default function HistoryPanel({ steps, onUndo, onReset, onDownloadCSV, onDownloadJSON }: HistoryPanelProps) {
  
  const handleDownloadRecipe = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(steps, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "cleansing_recipe.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Error exporting JSON recipe.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="etl-history-download-panel">
      {/* Visual recipe pipeline */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs lg:col-span-2 flex flex-col" id="recipe-pipeline-card">
        <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="font-sans font-semibold text-sm text-slate-800">
              Applied Cleaning Recipe Timeline
            </h3>
          </div>
          <div className="flex gap-2">
            {steps.length > 0 && (
              <button
                onClick={onUndo}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-sans font-medium hover:underline bg-slate-50 hover:bg-slate-100 p-1.5 px-3 rounded-lg border border-slate-100 cursor-pointer"
                id="undo-action-button"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                Undo Step
              </button>
            )}
            <button
              onClick={onReset}
              disabled={steps.length === 0}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-sans font-medium disabled:opacity-50 disabled:hover:bg-transparent hover:bg-rose-50/50 p-1.5 px-3 rounded-lg transition-colors cursor-pointer"
              id="reset-entire-sheet"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All
            </button>
          </div>
        </div>

        <div className="space-y-3/2 overflow-y-auto max-h-48 pr-1 font-sans flex-1" id="timeline-scroll-grid">
          {steps.map((step, idx) => (
            <div key={step.id} className="relative pl-6 pb-2 last:pb-0 group">
              {/* Timeline Connector Line */}
              {idx < steps.length - 1 && (
                <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-indigo-100 group-hover:bg-indigo-200 transition-colors" />
              )}
              
              {/* Bullet Node */}
              <div className="absolute left-1 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-indigo-500 bg-white shadow-xs" />

              <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/80 flex justify-between items-start gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-sm font-bold">
                      STEP {idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {step.timestamp}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 font-sans mt-1">
                    {step.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono text-[10px] border border-emerald-100/50 font-medium">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          ))}

          {steps.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400 font-sans italic" id="empty-recipe-timeline">
              No cleaning transformations applied yet. Select operations above to begin refining your messy data!
            </div>
          )}
        </div>
      </div>

      {/* Export actions card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between" id="data-export-card">
        <div>
          <h3 className="font-sans font-semibold text-sm text-slate-800 mb-1">
            Export Cleansed Sheets
          </h3>
          <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
            Download your refined, structured, and completely normalized dataset as standard file formats, ready for immediate machine learning or SQL imports.
          </p>
        </div>

        <div className="space-y-2 mt-4 font-sans">
          <button
            onClick={onDownloadCSV}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/60 text-emerald-800 transition-colors text-xs font-medium font-sans cursor-pointer group"
            id="download-cleaned-csv"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600 group-hover:translate-y-0.5 transition-transform" />
              Download Cleaned CSV
            </span>
            <span className="text-[10px] text-emerald-600 bg-emerald-100/50 rounded px-1.5 font-mono">.csv</span>
          </button>

          <button
            onClick={onDownloadJSON}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/60 text-indigo-800 transition-colors text-xs font-medium font-sans cursor-pointer group"
            id="download-cleaned-json"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-600 group-hover:translate-y-0.5 transition-transform" />
              Download Cleaned JSON
            </span>
            <span className="text-[10px] text-indigo-600 bg-indigo-100/50 rounded px-1.5 font-mono">.json</span>
          </button>

          <button
            onClick={handleDownloadRecipe}
            disabled={steps.length === 0}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-700 transition-colors text-xs font-medium font-sans cursor-pointer group"
            id="download-etl-recipe"
          >
            <span className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-slate-500" />
              Export Cleaning Recipe JSON
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 font-mono">RECIPE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
