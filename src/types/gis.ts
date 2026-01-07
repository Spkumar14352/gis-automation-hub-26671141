export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface GDBExtractionConfig {
  sourceGdbPath: string;
  outputFolder: string;
}

export interface SDEConversionConfig {
  sourceConnection: string;
  targetConnection: string;
  selectedFeatureClasses: string[];
}

export interface ComparisonConfig {
  sourceConnection: string;
  targetConnection: string;
  comparisonType: 'schema' | 'attribute' | 'spatial';
}

export interface ExecutionResult {
  status: ExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  logs: LogEntry[];
  summary?: Record<string, unknown>;
}
