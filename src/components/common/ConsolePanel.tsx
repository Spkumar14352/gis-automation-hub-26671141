import { useEffect, useRef } from 'react';
import { LogEntry } from '@/types/gis';
import { cn } from '@/lib/utils';
import { Terminal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface ConsolePanelProps {
  logs: LogEntry[];
  onClear?: () => void;
  className?: string;
}

export function ConsolePanel({ logs, onClear, className }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLineClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-console-success';
      case 'error':
        return 'text-console-error';
      case 'warning':
        return 'text-console-warning';
      default:
        return 'text-console-info';
    }
  };

  const getPrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return '›';
    }
  };

  return (
    <div className={cn('flex flex-col rounded-lg overflow-hidden border border-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-console border-b border-border">
        <div className="flex items-center gap-2 text-console-foreground">
          <Terminal className="w-4 h-4" />
          <span className="text-sm font-medium">Console Output</span>
          <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Console Body */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto bg-console p-2 font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Waiting for execution...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'flex gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors animate-fade-in',
                getLineClass(log.type)
              )}
            >
              <span className="text-muted-foreground text-xs min-w-[70px]">
                {format(log.timestamp, 'HH:mm:ss')}
              </span>
              <span className="w-4 text-center">{getPrefix(log.type)}</span>
              <span className="flex-1">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
