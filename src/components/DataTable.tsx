import { useState } from 'react';
import { Calendar, Hash, Type, ToggleLeft, HelpCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dataset, ColumnType } from '../types';
import { detectColumnType } from '../utils/cleaning';

interface DataTableProps {
  dataset: Dataset;
  selectedColumn: string | null;
  onSelectColumn: (colName: string) => void;
}

const ITEMS_PER_PAGE = 8;

export default function DataTable({ dataset, selectedColumn, onSelectColumn }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Re-evaluate types on active sheet
  const colTypes = dataset.columns.reduce((acc, col) => {
    acc[col] = detectColumnType(dataset.rows.map(r => r[col]));
    return acc;
  }, {} as Record<string, ColumnType>);

  // Find duplicates on full-row level
  const rowStrings = dataset.rows.map(row => JSON.stringify(row));
  const duplicateIndices = new Set<number>();
  const seenRows = new Set<string>();

  rowStrings.forEach((rowStr, idx) => {
    if (seenRows.has(rowStr)) {
      duplicateIndices.add(idx);
    } else {
      seenRows.add(rowStr);
    }
  });

  const totalRows = dataset.rows.length;
  const totalPages = Math.ceil(totalRows / ITEMS_PER_PAGE) || 1;
  const paginatedRows = dataset.rows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTypeIcon = (type: ColumnType) => {
    switch (type) {
      case 'numeric':
        return <Hash className="w-3 h-3 text-emerald-500" />;
      case 'date':
        return <Calendar className="w-3 h-3 text-blue-500" />;
      case 'text':
        return <Type className="w-3 h-3 text-purple-500" />;
      case 'boolean':
        return <ToggleLeft className="w-3 h-3 text-orange-500" />;
      default:
        return <HelpCircle className="w-3 h-3 text-slate-400" />;
    }
  };

  const getTypeStyle = (type: ColumnType) => {
    switch (type) {
      case 'numeric': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'date': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'text': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'boolean': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" id="data-table-card">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-sans font-semibold text-sm text-slate-800">
            Dataset Preview & Verification
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Click any column header to view statistics or customize transformations on that column.
          </p>
        </div>
        
        {/* Pagination controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-xs text-slate-500 font-mono select-none">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
              id="prev-page-button"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
              id="next-page-button"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse" id="data-cleansing-grid-table">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100">
              <th className="p-3 w-12 font-mono text-[10px] text-slate-400 text-center select-none">#</th>
              {dataset.columns.map((col) => {
                const isSelected = selectedColumn === col;
                const type = colTypes[col];
                return (
                  <th
                    key={col}
                    onClick={() => onSelectColumn(col)}
                    className={`p-3 cursor-pointer select-none border-r border-slate-50 last:border-0 transition-colors ${
                      isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`font-sans font-semibold text-xs transition-colors ${
                        isSelected ? 'text-indigo-900 border-b border-indigo-500' : 'text-slate-700'
                      }`}>
                        {col}
                      </span>
                      <span className={`inline-flex items-center p-0.5 rounded border text-[10px] font-mono leading-none ${getTypeStyle(type)}`}>
                        {getTypeIcon(type)}
                        <span className="ml-1 uppercase text-[8px] tracking-wide font-sans">{type}</span>
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, relativeIdx) => {
              const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + relativeIdx;
              const isDuplicateRow = duplicateIndices.has(absoluteIdx);

              return (
                <tr
                  key={absoluteIdx}
                  className={`border-b border-slate-50 last:border-0 group transition-all duration-150 ${
                    isDuplicateRow ? 'bg-amber-50/15 hover:bg-amber-50/25 border-l-2 border-l-amber-400' : 'hover:bg-slate-50/30'
                  }`}
                >
                  <td className="p-3 text-center font-mono text-[10px] text-slate-400 select-none bg-slate-50/10">
                    {isDuplicateRow ? (
                      <span className="inline-flex mt-0.5 text-amber-600 bg-amber-100/60 px-1 py-0.5 rounded font-sans font-bold text-[8px]" title="Identical Duplicate Row">
                        DUP
                      </span>
                    ) : (
                      absoluteIdx + 1
                    )}
                  </td>
                  {dataset.columns.map((col) => {
                    const val = row[col];
                    const isSelectedCol = selectedColumn === col;
                    const isNull = val === null || val === undefined || String(val).trim() === '';

                    return (
                      <td
                        key={col}
                        className={`p-3 text-xs font-sans transition-colors border-r border-slate-50/60 last:border-r-0 ${
                          isSelectedCol ? 'bg-indigo-50/10' : ''
                        }`}
                      >
                        {isNull ? (
                          <span className="inline-flex bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-mono italic text-[10px] select-none border border-orange-100/50">
                            null
                          </span>
                        ) : (
                          <span className={`${isDuplicateRow ? 'text-slate-600' : 'text-slate-700'} break-all font-sans whitespace-pre-wrap`}>
                            {String(val)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {totalRows === 0 && (
        <div className="p-12 text-center flex flex-col items-center justify-center" id="empty-state-banner">
          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-slate-600 font-sans font-medium text-xs">Dataset is empty</p>
          <p className="text-slate-400 font-sans text-[11px] mt-1">Please load a preset or upload your messy spreadsheet above.</p>
        </div>
      )}
    </div>
  );
}
