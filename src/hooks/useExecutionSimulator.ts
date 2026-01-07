import { useState, useCallback } from 'react';
import { ExecutionStatus, LogEntry } from '@/types/gis';

interface UseExecutionSimulatorReturn {
  status: ExecutionStatus;
  logs: LogEntry[];
  execute: (simulatedLogs: Array<{ type: LogEntry['type']; message: string; delay: number }>) => Promise<boolean>;
  reset: () => void;
}

export function useExecutionSimulator(): UseExecutionSimulatorReturn {
  const [status, setStatus] = useState<ExecutionStatus>('pending');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  const execute = useCallback(async (simulatedLogs: Array<{ type: LogEntry['type']; message: string; delay: number }>) => {
    setStatus('running');
    setLogs([]);

    for (const log of simulatedLogs) {
      await new Promise(resolve => setTimeout(resolve, log.delay));
      addLog(log.type, log.message);
      
      if (log.type === 'error') {
        setStatus('failed');
        return false;
      }
    }

    setStatus('success');
    return true;
  }, [addLog]);

  const reset = useCallback(() => {
    setStatus('pending');
    setLogs([]);
  }, []);

  return { status, logs, execute, reset };
}
