import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Database, ArrowLeftRight, GitCompare, Clock, 
  CheckCircle, XCircle, Loader2, Play, Settings,
  Server, AlertCircle, Wand2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJobHistory, JobHistory as JobHistoryEntry } from '@/hooks/useJobHistory';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { SetupWizard } from '@/components/setup/SetupWizard';

const quickActions = [
  {
    title: 'GDB Extraction',
    description: 'Extract data from Geodatabase',
    icon: Database,
    path: '/gdb-extraction',
    color: 'text-blue-500',
  },
  {
    title: 'SDE to SDE',
    description: 'Migrate feature classes',
    icon: ArrowLeftRight,
    path: '/sde-conversion',
    color: 'text-green-500',
  },
  {
    title: 'FC Comparison',
    description: 'Compare datasets',
    icon: GitCompare,
    path: '/comparison',
    color: 'text-purple-500',
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getJobTypeLabel = (type: string) => {
  switch (type) {
    case 'gdb_extraction':
      return 'GDB Extraction';
    case 'sde_conversion':
      return 'SDE Conversion';
    case 'comparison':
      return 'Comparison';
    default:
      return type;
  }
};

export default function Dashboard() {
  const { fetchJobs } = useJobHistory();
  const [recentJobs, setRecentJobs] = useState<JobHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pythonBackendUrl] = useLocalStorage('python-backend-url', '');
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasSeenWizard, setHasSeenWizard] = useLocalStorage('has-seen-setup-wizard', false);

  useEffect(() => {
    loadRecentJobs();
    if (pythonBackendUrl) {
      checkBackendStatus();
    } else if (!hasSeenWizard) {
      // Show setup wizard on first visit if backend is not configured
      setShowSetupWizard(true);
    }
  }, [pythonBackendUrl, hasSeenWizard]);

  const loadRecentJobs = async () => {
    setLoading(true);
    const jobs = await fetchJobs();
    setRecentJobs(jobs.slice(0, 5));
    setLoading(false);
  };

  const checkBackendStatus = async () => {
    if (!pythonBackendUrl) {
      setBackendStatus('unknown');
      return;
    }

    setCheckingBackend(true);
    try {
      const response = await fetch(`${pythonBackendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      setBackendStatus(response.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    } finally {
      setCheckingBackend(false);
    }
  };

  const jobStats = {
    total: recentJobs.length,
    success: recentJobs.filter(j => j.status === 'success').length,
    failed: recentJobs.filter(j => j.status === 'failed').length,
    running: recentJobs.filter(j => j.status === 'running').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to GIS Hub Automation Toolbox</p>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Python Backend</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {checkingBackend ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : backendStatus === 'online' ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  Online
                </Badge>
              ) : backendStatus === 'offline' ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  Offline
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Not Configured
                </Badge>
              )}
            </div>
            {!pythonBackendUrl && (
              <p className="text-xs text-muted-foreground mt-2">
                <Link to="/settings" className="text-primary hover:underline">
                  Configure in Settings
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.total}</div>
            <p className="text-xs text-muted-foreground">Recent executions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{jobStats.success}</div>
            <p className="text-xs text-muted-foreground">Completed successfully</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{jobStats.failed}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a new job</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className={cn('p-2 rounded-lg bg-muted', action.color)}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Latest executions</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/history">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No jobs executed yet</p>
                <p className="text-sm">Start by running a GDB extraction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getJobTypeLabel(job.job_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        job.status === 'success' && 'bg-green-500/10 text-green-600',
                        job.status === 'failed' && 'bg-destructive/10 text-destructive',
                        job.status === 'running' && 'bg-blue-500/10 text-blue-600'
                      )}
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Backend Notice */}
      {!pythonBackendUrl && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-4 pt-6">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-600">Python Backend Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                To execute GIS operations, you need to set up the Python/ArcPy backend on your server.
                Download the backend script and configure the URL in Settings.
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="default" size="sm" onClick={() => setShowSetupWizard(true)}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Setup Wizard
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Go to Settings
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SetupWizard 
        open={showSetupWizard} 
        onOpenChange={setShowSetupWizard} 
        onComplete={() => setHasSeenWizard(true)}
      />
    </div>
  );
}
