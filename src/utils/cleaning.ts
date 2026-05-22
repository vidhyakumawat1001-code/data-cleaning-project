import { ColumnType, ColumnMetric, Dataset, DataQualitySummary } from '../types';

/**
 * Robust date-parsing utility.
 * Tries several formats to understand arbitrary inputs.
 */
export function tryParseDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '') return null;

  // Check if it's a Unix Timestamp (string or number, e.g. "1673827200")
  if (/^\d{10}$/.test(str)) {
    const timestampSec = parseInt(str, 10);
    const date = new Date(timestampSec * 1000);
    if (!isNaN(date.getTime())) return date;
  }

  // Check if it's a Unix Timestamp in milliseconds (e.g., "1673827200000")
  if (/^\d{13}$/.test(str)) {
    const timestampMs = parseInt(str, 10);
    const date = new Date(timestampMs);
    if (!isNaN(date.getTime())) return date;
  }

  // Try parsing ISO, standard hyphenated, or standard slash structures
  // Some standard formats like DD/MM/YYYY might get parsed wrong by system built-ins
  // Let us check regex for DD/MM/YYYY or DD-MM-YYYY specifically.
  const dmyRegex = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/;
  const dmyMatch = str.match(dmyRegex);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    // If m indicates month (1-12) and d indicates day (1-31), construct date
    // Note: JS Date constructor works in local, let's treat months as 0-indexed
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      // Check if maybe it was MM/DD/YYYY instead. If m > 12, it must be DD/MM/YYYY.
      // If both <= 12, we lean towards either. Let's build a standard date:
      // In DMY format:
      const candidate = new Date(y, m - 1, d);
      if (!isNaN(candidate.getTime())) return candidate;
    }
  }

  // Fallback to JS standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Format a Date object into a chosen string template.
 */
export function formatDateValue(date: Date, formatTemplate: string): string {
  if (isNaN(date.getTime())) return '';
  
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const m = (date.getMonth() + 1).toString();
  const mm = m.padStart(2, '0');
  const d = date.getDate().toString();
  const dd = d.padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const sec = date.getSeconds().toString().padStart(2, '0');

  switch (formatTemplate) {
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'YYYY/MM/DD':
      return `${yyyy}/${mm}/${dd}`;
    case 'YYYY-MM-DD HH:mm:ss':
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
    case 'ISO 8601':
      return date.toISOString();
    case 'Unix Timestamp (sec)':
      return Math.floor(date.getTime() / 1000).toString();
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Detect column data type based on active non-null values.
 */
export function detectColumnType(values: any[]): ColumnType {
  const nonNulls = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNulls.length === 0) return 'empty';

  let numericCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let textCount = 0;

  for (const val of nonNulls) {
    const str = String(val).trim().toLowerCase();
    
    // Check boolean
    if (str === 'true' || str === 'false' || str === 'yes' || str === 'no') {
      booleanCount++;
      continue;
    }

    // Check numeric (exclude UNIX timestamps if they look like standard text strings, but verify numbers)
    // If it's a pure number or negative number
    const isNum = !isNaN(Number(str)) && !/^\d{4}[\-\/]\d{1,2}/.test(str);
    if (isNum) {
      numericCount++;
      continue;
    }

    // Check date (must parse and look like date format, let's look for delimiters)
    if (/[\-\/:]/.test(str) || /^[a-zA-Z]{3,}\s+\d{1,2}/.test(str)) {
      const isDate = tryParseDate(val) !== null;
      if (isDate) {
        dateCount++;
        continue;
      }
    }

    textCount++;
  }

  const threshold = nonNulls.length * 0.7; // 70% matching means that type
  if (numericCount >= threshold) return 'numeric';
  if (dateCount >= threshold) return 'date';
  if (booleanCount >= threshold) return 'boolean';
  if (textCount >= threshold) return 'text';

  return 'mixed';
}

/**
 * Compile detailed analysis metrics of a specific column.
 */
export function analyzeColumn(colName: string, rows: any[]): ColumnMetric {
  const totalCount = rows.length;
  const values = rows.map(r => r[colName]);
  
  const nonNulls = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  const missingCount = totalCount - nonNulls.length;
  const fillRate = totalCount > 0 ? parseFloat(((nonNulls.length / totalCount) * 100).toFixed(1)) : 100;

  // Counts of unique items
  const summaryMap: Record<string, number> = {};
  for (const v of values) {
    const displayVal = (v === null || v === undefined || String(v).trim() === '') ? '(null / empty)' : String(v);
    summaryMap[displayVal] = (summaryMap[displayVal] || 0) + 1;
  }

  const uniqueCount = Object.keys(summaryMap).filter(k => k !== '(null / empty)').length;
  
  // Sort elements by sample size descending
  const uniqueValuesSummary = Object.entries(summaryMap)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  const detectedType = detectColumnType(values);

  return {
    name: colName,
    type: detectedType,
    missingCount,
    totalCount,
    fillRate,
    uniqueCount,
    uniqueValuesSummary
  };
}

/**
 * Calculates overall statistics and quality score.
 */
export function calculateQualityMetrics(dataset: Dataset): DataQualitySummary {
  const totalRows = dataset.rows.length;
  const totalColumns = dataset.columns.length;
  const totalCells = totalRows * totalColumns;

  if (totalRows === 0) {
    return {
      overallScore: 100,
      duplicateRowsCount: 0,
      totalCellsCount: 0,
      missingCellsCount: 0,
      missingCellsPercentage: 0,
      dateMismatchCount: 0
    };
  }

  let missingCellsCount = 0;
  for (const row of dataset.rows) {
    for (const col of dataset.columns) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === '') {
        missingCellsCount++;
      }
    }
  }

  // Count duplicate rows
  const stringifiedRows = dataset.rows.map(r => JSON.stringify(r));
  const seenRows = new Set<string>();
  let duplicateCount = 0;
  for (const rowStr of stringifiedRows) {
    if (seenRows.has(rowStr)) {
      duplicateCount++;
    } else {
      seenRows.add(rowStr);
    }
  }

  // Detect mismatched dates (columns that are classified as dates but contain unparseable string tags)
  // Let's check each date column
  let dateMismatchCount = 0;
  for (const col of dataset.columns) {
    const colType = detectColumnType(dataset.rows.map(r => r[col]));
    if (colType === 'date') {
      for (const row of dataset.rows) {
        const val = row[col];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          // If it can't be parsed or isn't formatted cleanly
          if (tryParseDate(val) === null) {
            dateMismatchCount++;
          }
        }
      }
    }
  }

  // Calculate quality index:
  // - Starts at 100
  // - Deduct up to 40 pts for missing values (weighted by missing cells fraction)
  // - Deduct up to 30 pts for duplicate records density
  // - Deduct up to 20 pts for unparseable dates inside known date columns
  // - Deduct up to 10 pts if any column has a 'mixed' or confusing type
  let qualityScore = 100;

  const missingFrac = totalCells > 0 ? missingCellsCount / totalCells : 0;
  qualityScore -= missingFrac * 40;

  const duplicateFrac = totalRows > 1 ? duplicateCount / totalRows : 0;
  qualityScore -= duplicateFrac * 30;

  const dateValsCount = totalRows; // proxy
  const dateMismatchFrac = dateValsCount > 0 ? dateMismatchCount / dateValsCount : 0;
  qualityScore -= Math.min(20, dateMismatchFrac * 40);

  // Mixed type deduction
  let mixedColumnsCount = 0;
  for (const col of dataset.columns) {
    const type = detectColumnType(dataset.rows.map(r => r[col]));
    if (type === 'mixed') {
      mixedColumnsCount++;
    }
  }
  qualityScore -= Math.min(10, mixedColumnsCount * 5);

  const overallScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  return {
    overallScore,
    duplicateRowsCount: duplicateCount,
    totalCellsCount: totalCells,
    missingCellsCount,
    missingCellsPercentage: totalCells > 0 ? parseFloat(((missingCellsCount / totalCells) * 100).toFixed(1)) : 0,
    dateMismatchCount
  };
}

/**
 * Text Casing transformation helpers
 */
export function transformTextCase(val: any, transformType: 'lower' | 'upper' | 'title' | 'sentence' | 'trim'): string {
  if (val === null || val === undefined) return '';
  const str = String(val);

  if (transformType === 'trim') {
    return str.replace(/\s+/g, ' ').trim();
  }

  const trimmed = str.trim();
  switch (transformType) {
    case 'lower':
      return trimmed.toLowerCase();
    case 'upper':
      return trimmed.toUpperCase();
    case 'title':
      return trimmed
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    case 'sentence':
      if (trimmed.length === 0) return '';
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    default:
      return trimmed;
  }
}
