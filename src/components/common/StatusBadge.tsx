import { cn } from '@/lib/utils';
import { ExecutionStatus } from '@/types/gis';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const statusConfig: Record<ExecutionStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'status-pending',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'status-running',
  },
  success: {
    label: 'Success',
    icon: CheckCircle2,
    className: 'status-success',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'status-failed',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('status-badge', config.className, className)}>
      <Icon className={cn('w-3.5 h-3.5', status === 'running' && 'animate-spin')} />
      {config.label}
    </span>
  );
}
