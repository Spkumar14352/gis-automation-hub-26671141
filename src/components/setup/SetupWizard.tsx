import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ChevronRight, ChevronLeft, Server, Folder, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const COMMON_PYTHON_PATHS = [
  'C:\\Program Files\\ArcGIS\\Pro\\bin\\Python\\envs\\arcgispro-py3\\python.exe',
  'C:\\Python39\\python.exe',
  'C:\\Python310\\python.exe',
  'C:\\Python311\\python.exe',
  '/usr/bin/python3',
  '/usr/local/bin/python3',
];

export function SetupWizard({ open, onOpenChange, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [backendUrl, setBackendUrl] = useLocalStorage('python-backend-url', 'http://localhost:5000');
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    arcpyAvailable?: boolean;
    pythonPath?: string;
    error?: string;
  } | null>(null);

  const totalSteps = 3;

  const testConnection = async () => {
    setTesting(true);
    setConnectionResult(null);

    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionResult({
          success: true,
          arcpyAvailable: data.arcpy_available,
          pythonPath: data.pythonPath,
        });
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setConnectionResult({
        success: false,
        error: 'Could not connect to backend. Make sure the server is running.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = () => {
    toast.success('Setup completed! You can now use GIS tools.');
    onComplete?.();
    onOpenChange(false);
    setStep(1);
    setConnectionResult(null);
  };

  const handleSkip = () => {
    toast.info('Setup skipped. You can configure the backend later in Settings.');
    onOpenChange(false);
    setStep(1);
    setConnectionResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure your GIS Automation Hub backend connection
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s < step
                    ? 'bg-primary text-primary-foreground'
                    : s === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    s < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[200px]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium">Welcome to GIS Automation Hub</h3>
              <p className="text-sm text-muted-foreground">
                This wizard will help you connect to your Node.js backend server that handles GIS operations with ArcPy.
              </p>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Prerequisites:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Node.js 18+ installed on your server</li>
                  <li>ArcGIS Pro with Python (for ArcPy operations)</li>
                  <li>The Node.js backend running locally or on a server</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-sm font-medium text-primary">Quick Start with Docker:</p>
                <code className="block mt-2 text-xs bg-muted p-2 rounded">
                  cd public/node-backend && docker-compose up -d
                </code>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium">Backend URL Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Enter the URL where your Node.js backend server is running.
              </p>
              <div className="space-y-2">
                <Label htmlFor="backend-url">Backend URL</Label>
                <Input
                  id="backend-url"
                  value={backendUrl}
                  onChange={(e) => {
                    setBackendUrl(e.target.value);
                    setConnectionResult(null);
                  }}
                  placeholder="http://localhost:5000"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Default: http://localhost:5000 (local development)
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Common configurations:</p>
                <div className="flex flex-wrap gap-2">
                  {['http://localhost:5000', 'http://127.0.0.1:5000', 'http://gis-server:5000'].map((url) => (
                    <Button
                      key={url}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setBackendUrl(url);
                        setConnectionResult(null);
                      }}
                    >
                      {url}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium">Test Connection</h3>
              <p className="text-sm text-muted-foreground">
                Let's verify your backend is running and accessible.
              </p>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-sm">Backend URL</p>
                    <p className="text-xs text-muted-foreground font-mono">{backendUrl}</p>
                  </div>
                  <Button onClick={testConnection} disabled={testing}>
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>

                {connectionResult && (
                  <div
                    className={`p-3 rounded-lg ${
                      connectionResult.success
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {connectionResult.success ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          {connectionResult.success ? 'Connection successful!' : 'Connection failed'}
                        </p>
                        {connectionResult.success ? (
                          <>
                            <p className="text-xs">
                              Python path: <code className="bg-muted px-1 rounded">{connectionResult.pythonPath}</code>
                            </p>
                          </>
                        ) : (
                          <p className="text-xs">{connectionResult.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!connectionResult?.success && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Troubleshooting:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Ensure Node.js backend is running on the specified port</li>
                    <li>Check firewall settings if connecting to a remote server</li>
                    <li>Verify the URL includes the correct protocol (http/https)</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={!connectionResult?.success}>
                Complete Setup
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
