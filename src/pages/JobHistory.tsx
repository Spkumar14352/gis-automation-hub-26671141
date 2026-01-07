import { useState, useEffect } from 'react';
import { History, Play, Eye, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useJobHistory, JobHistory as JobHistoryType } from '@/hooks/useJobHistory';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConsolePanel } from '@/components/common/ConsolePanel';
import { ExecutionStatus, LogEntry } from '@/types/gis';

const jobTypeLabels: Record<string, string> = {
  gdb_extraction: 'GDB Extraction',
  sde_conversion: 'SDE to SDE',
  comparison: 'FC Comparison',
};

export default function JobHistoryPage() {
  const [jobs, setJobs] = useState<JobHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobHistoryType | null>(null);
  const { fetchJobs } = useJobHistory();

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch (error) {
      toast.error('Failed to load job history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const convertLogs = (logs: JobHistoryType['logs']): LogEntry[] => {
    return logs.map((log, index) => ({
      id: `${index}`,
      timestamp: new Date(log.timestamp),
      type: log.type as LogEntry['type'],
      message: log.message,
    }));
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={History}
        title="Job History"
        description="View and manage your past script executions"
        actions={
          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No jobs yet</p>
            <p className="text-sm text-muted-foreground">
              Your executed scripts will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <Play className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">{jobTypeLabels[job.job_type]}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={job.status as ExecutionStatus} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedJob(job)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedJob && jobTypeLabels[selectedJob.job_type]}
              {selectedJob && <StatusBadge status={selectedJob.status as ExecutionStatus} />}
            </DialogTitle>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedJob.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                </div>
                {selectedJob.started_at && (
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p>{format(new Date(selectedJob.started_at), 'MMM d, yyyy HH:mm:ss')}</p>
                  </div>
                )}
                {selectedJob.completed_at && (
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p>{format(new Date(selectedJob.completed_at), 'MMM d, yyyy HH:mm:ss')}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Configuration</p>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedJob.config, null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Logs</p>
                <ConsolePanel logs={convertLogs(selectedJob.logs)} className="max-h-[200px]" />
              </div>

              {selectedJob.result && (
                <div>
                  <p className="text-sm font-medium mb-2">Result</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
