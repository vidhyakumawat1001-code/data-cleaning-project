export type ColumnType = 'numeric' | 'date' | 'text' | 'boolean' | 'empty' | 'mixed';

export interface ColumnMetric {
  name: string;
  type: ColumnType;
  missingCount: number;
  totalCount: number;
  fillRate: number; // 0 to 100
  uniqueCount: number;
  uniqueValuesSummary: Array<{ value: string; count: number }>;
}

export interface Dataset {
  name: string;
  columns: string[];
  rows: Array<Record<string, any>>;
}

export interface CleaningStep {
  id: string;
  description: string;
  actionType: 'missing' | 'dedub' | 'date' | 'text_case' | 'category_map' | 'reset';
  targetColumn?: string;
  timestamp: string;
  affectedRows: number;
}

export interface DataQualitySummary {
  overallScore: number; // 0 to 100
  duplicateRowsCount: number;
  totalCellsCount: number;
  missingCellsCount: number;
  missingCellsPercentage: number;
  dateMismatchCount: number;
}
