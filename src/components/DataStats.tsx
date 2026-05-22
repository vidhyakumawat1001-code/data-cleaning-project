import { Layers, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { DataQualitySummary, Dataset } from '../types';

interface DataStatsProps {
  metrics: DataQualitySummary;
  dataset: Dataset;
  onQuickDedup?: () => void;
  onQuickFillNulls?: () => void;
}

export default function DataStats({ metrics, dataset, onQuickDedup, onQuickFillNulls }: DataStatsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', progress: 'stroke-emerald-500', text: 'text-emerald-600' };
    if (score >= 70) return { bg: 'bg-amber-50 text-amber-700 border-amber-100', progress: 'stroke-amber-500', text: 'text-amber-500' };
    return { bg: 'bg-rose-50 text-rose-700 border-rose-100', progress: 'stroke-rose-500', text: 'text-rose-600' };
  };

  const scoreTheme = getScoreColor(metrics.overallScore);
  const totalRows = dataset.rows.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="data-stats-cards-grid">
      {/* Circle progress scorecard */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center gap-4" id="quality-scorecard">
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              className="stroke-slate-100 fill-none"
              strokeWidth="5"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              className={`fill-none transition-all duration-500 ${scoreTheme.progress}`}
              strokeWidth="5"
              strokeDasharray={175}
              strokeDashoffset={175 - (175 * metrics.overallScore) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute font-mono text-sm font-bold text-slate-800">
            {metrics.overallScore}%
          </div>
        </div>
        <div>
          <h4 className="text-slate-400 font-sans font-medium text-[11px] tracking-wider uppercase">
            Data Quality Score
          </h4>
          <p className="text-xs text-slate-500 mt-1 leading-normal font-sans">
            {metrics.overallScore >= 95 
              ? 'Prisinte dataset, completely ready for training or analytics.'
              : metrics.overallScore >= 80
              ? 'Acceptable quality. Some minor formatting needs unifying.'
              : 'Messy data structure. Resolving anomalies is recommended.'}
          </p>
        </div>
      </div>

      {/* Duplicate items metrics card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between" id="metric-duplicates-card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-slate-400 font-sans font-medium text-[11px] tracking-wider uppercase">
              Duplicate Records
            </h4>
            <p className="text-xl font-bold font-mono text-slate-800 mt-1">
              {metrics.duplicateRowsCount} <span className="text-xs font-normal text-slate-400 font-sans">rows</span>
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${metrics.duplicateRowsCount > 0 ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
            <Layers className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          {metrics.duplicateRowsCount > 0 ? (
            <button
              onClick={onQuickDedup}
              className="text-[10px] text-amber-600 hover:text-amber-700 hover:underline font-medium font-sans flex items-center gap-1.5 cursor-pointer"
              id="quick-dedup-button"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Remove duplicates instantly
            </button>
          ) : (
            <span className="text-[10px] text-emerald-600 font-semibold font-sans flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Dataset has no duplicate rows
            </span>
          )}
        </div>
      </div>

      {/* Completeness index cards */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between" id="metric-completeness-card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-slate-400 font-sans font-medium text-[11px] tracking-wider uppercase">
              Completeness Index
            </h4>
            <p className="text-xl font-bold font-mono text-slate-800 mt-1">
              {(100 - metrics.missingCellsPercentage).toFixed(1)}% <span className="text-xs font-normal text-slate-400 font-sans">filled</span>
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${metrics.missingCellsCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          {metrics.missingCellsCount > 0 ? (
            <button
              onClick={onQuickFillNulls}
              className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline font-medium font-sans flex items-center gap-1.5 cursor-pointer"
              id="quick-fill-nulls-button"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Resolve {metrics.missingCellsCount} missing values
            </button>
          ) : (
            <span className="text-[10px] text-emerald-600 font-semibold font-sans flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              All cells are completely filled
            </span>
          )}
        </div>
      </div>

      {/* Grid dataset layout details */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between" id="metric-size-card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-slate-400 font-sans font-medium text-[11px] tracking-wider uppercase">
              Active Dataset Size
            </h4>
            <p className="text-xl font-bold font-mono text-slate-800 mt-1">
              {totalRows} <span className="text-xs font-normal text-slate-400 font-sans">×</span> {dataset.columns.length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400">
            <Database className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-[10px] text-slate-500 font-mono">
            Total Cells: {metrics.totalCellsCount} datapoints
          </span>
        </div>
      </div>
    </div>
  );
}
