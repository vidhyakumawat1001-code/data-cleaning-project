import { useMemo } from 'react';
import { HelpCircle, AlertCircle, Sparkles, CheckCircle, BrainCircuit } from 'lucide-react';
import { Dataset } from '../types';
import { analyzeColumn } from '../utils/cleaning';

interface ColumnDetailsProps {
  dataset: Dataset;
  selectedColumn: string | null;
  onSelectColumn: (col: string | null) => void;
}

export default function ColumnDetails({ dataset, selectedColumn, onSelectColumn }: ColumnDetailsProps) {
  
  const metric = useMemo(() => {
    if (!selectedColumn) return null;
    return analyzeColumn(selectedColumn, dataset.rows);
  }, [selectedColumn, dataset.rows]);

  // Dynamic recommendations engine based on column metrics
  const recommendations = useMemo(() => {
    if (!metric) return [];
    const recs: string[] = [];

    if (metric.missingCount > 0) {
      recs.push(`This column contains ${metric.missingCount} missing value(s). Use the "Missing Values" cleaning panel to impute standard defaults or drop affected rows safely.`);
    }

    if (metric.type === 'mixed') {
      recs.push(`Detected mixed data types inside [${metric.name}]. Standardizing casing or replacing text strings is highly recommended to establish unified schema.`);
    }

    // Check if there are duplicate category variants (e.g. "active" and "ACTIVE", or "usa " and "USA")
    const cleanNames = new Set<string>();
    let duplicatesSpotted = false;
    
    metric.uniqueValuesSummary.forEach(u => {
      if (u.value === '(null / empty)') return;
      const lowerClean = u.value.toLowerCase().trim();
      if (cleanNames.has(lowerClean)) {
        duplicatesSpotted = true;
      }
      cleanNames.add(lowerClean);
    });

    if (duplicatesSpotted) {
      recs.push(`Spotted minor orthographic or casing duplicates in your categories (e.g., similar terms with trailing spaces or casing offsets). Use the "Auto-Suggest Clusters" inside the text panel to merge them!`);
    }

    if (metric.type === 'date') {
      // Check if some strings look parseable but different format
      const hasSlashes = metric.uniqueValuesSummary.some(u => u.value.includes('/'));
      const hasDashes = metric.uniqueValuesSummary.some(u => u.value.includes('-'));
      if (hasSlashes && hasDashes) {
        recs.push(`Spotted mixed separators (slashes and hyphens) in date strings. Use the "Fix Dates" panel to unify formats.`);
      }
    }

    if (recs.length === 0) {
      recs.push(`Column [${metric.name}] of type ${metric.type.toUpperCase()} is verified 100% clean and normalized. Excellent!`);
    }

    return recs;
  }, [metric]);

  if (!metric) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[300px]" id="column-details-empty-state">
        <div className="p-3 bg-slate-50 text-slate-400 rounded-full mb-3">
          <BrainCircuit className="w-6 h-6 text-indigo-500 animate-pulse" />
        </div>
        <h4 className="font-sans font-semibold text-xs text-slate-700">Analytical Inspector</h4>
        <p className="text-[11px] text-slate-400 font-sans mt-1 max-w-xs leading-normal">
          Click any column name in the preview table below to load deep statistical splits, distinct values distributions, and structural recommendations.
        </p>
      </div>
    );
  }

  const overallMax = Math.max(...metric.uniqueValuesSummary.map(u => u.count)) || 1;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col h-full min-h-[400px]" id="column-details-active-inspector">
      <div className="flex justify-between items-start border-b border-slate-50 pb-3 mb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-indigo-600 font-sans tracking-wide">
            Detailed Schema Inspector
          </span>
          <h4 className="font-sans font-bold text-sm text-slate-800 flex items-center gap-1.5 mt-0.5">
            Column: {metric.name}
          </h4>
        </div>
        <button
          onClick={() => onSelectColumn(null)}
          className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline font-sans"
        >
          Close Inspector
        </button>
      </div>

      {/* Grid of micro indicators */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
          <span className="text-[9px] text-slate-400 uppercase font-bold font-sans tracking-tight">Main Type</span>
          <p className="text-xs font-bold text-slate-700 font-sans uppercase mt-0.5">{metric.type}</p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
          <span className="text-[9px] text-slate-400 uppercase font-bold font-sans tracking-tight">Completeness</span>
          <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">{metric.fillRate}%</p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
          <span className="text-[9px] text-slate-400 uppercase font-bold font-sans tracking-tight">Unique Values</span>
          <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">{metric.uniqueCount}</p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
          <span className="text-[9px] text-slate-400 uppercase font-bold font-sans tracking-tight">Missing Cells</span>
          <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">{metric.missingCount}</p>
        </div>
      </div>

      {/* Distinct values frequency tracker */}
      <div className="flex-1 flex flex-col mb-4">
        <span className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wide mb-2 block">
          Unique Value Frequencies
        </span>
        <div className="border border-slate-100/80 rounded-xl p-3 bg-slate-50/30 flex-1 overflow-y-auto max-h-52 space-y-2.5" id="unique-values-progress-scroller">
          {metric.uniqueValuesSummary.map((item, idx) => {
            const pct = Math.round((item.count / metric.totalCount) * 100);
            const isNullLabel = item.value === '(null / empty)';
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className={`font-mono font-medium truncate max-w-[130px] ${isNullLabel ? 'text-orange-500 italic font-sans' : 'text-slate-600'}`} title={item.value}>
                    {item.value}
                  </span>
                  <span className="text-slate-400 font-mono shrink-0 ml-1">
                    {item.count} rows ({pct}%)
                  </span>
                </div>
                {/* Visual meter bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isNullLabel ? 'bg-orange-400' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended actions card */}
      <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50" id="recommendations-box">
        <h5 className="text-[10px] uppercase font-bold text-indigo-900 font-sans flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          Cleaning Recommendations
        </h5>
        <div className="space-y-1.5 mt-1.5">
          {recommendations.map((rec, i) => (
            <p key={i} className="text-[10px] text-indigo-805/90 font-sans leading-relaxed flex items-start gap-1">
              <span className="text-indigo-500 text-xs shrink-0 mt-0.5">•</span>
              <span>{rec}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
