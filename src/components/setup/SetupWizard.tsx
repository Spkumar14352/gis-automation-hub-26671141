import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ChevronRight, ChevronLeft, Server, Loader2, AlertCircle, CheckCircle2, Search, FolderSearch, Copy, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface DetectedPython {
  path: string;
  version?: string;
  hasArcpy: boolean;
  isDefault?: boolean;
}

interface DbConfig {
  type: 'sqlite' | 'sqlserver';
  server: string;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustCert: boolean;
}

export function SetupWizard({ open, onOpenChange, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [backendUrl, setBackendUrl] = useLocalStorage('python-backend-url', 'http://localhost:5000');
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedPythons, setDetectedPythons] = useState<DetectedPython[]>([]);
  const [selectedPython, setSelectedPython] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    arcpyAvailable?: boolean;
    pythonPath?: string;
    error?: string;
  } | null>(null);
  
  // Database configuration state
  const [dbConfig, setDbConfig] = useState<DbConfig>({
    type: 'sqlite',
    server: '',
    database: 'GIS_Hub',
    user: '',
    password: '',
    encrypt: false,
    trustCert: true
  });
  const [testingDb, setTestingDb] = useState(false);
  const [dbResult, setDbResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const totalSteps = 5;

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

  const detectPythonPaths = async () => {
    setDetecting(true);
    setDetectedPythons([]);

    try {
      const response = await fetch(`${backendUrl}/detect-python`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setDetectedPythons(data.pythonInstallations || []);
        if (data.pythonInstallations?.length > 0) {
          // Auto-select the first ArcPy-enabled Python or the first one
          const arcpyPython = data.pythonInstallations.find((p: DetectedPython) => p.hasArcpy);
          setSelectedPython(arcpyPython?.path || data.pythonInstallations[0].path);
          toast.success(`Found ${data.pythonInstallations.length} Python installation(s)`);
        } else {
          toast.info('No Python installations found. You can enter the path manually.');
        }
      } else {
        throw new Error('Detection failed');
      }
    } catch (error) {
      toast.error('Could not detect Python. Make sure the backend is running.');
      setDetectedPythons([]);
    } finally {
      setDetecting(false);
    }
  };

  const applyPythonPath = async () => {
    if (!selectedPython) return;

    try {
      const response = await fetch(`${backendUrl}/set-python-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pythonPath: selectedPython }),
      });

      if (response.ok) {
        toast.success('Python path configured!');
        setStep(step + 1);
      } else {
        throw new Error('Failed to set Python path');
      }
    } catch (error) {
      // Even if the endpoint doesn't exist, continue - the path can be set via env var
      toast.info('Path selected. Set ARCPY_PYTHON_PATH on your server to apply.');
      setStep(step + 1);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const testDbConnection = async () => {
    setTestingDb(true);
    setDbResult(null);

    try {
      const response = await fetch(`${backendUrl}/configure-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig),
      });

      const data = await response.json();
      if (data.success) {
        setDbResult({ success: true, message: data.message });
        toast.success('Database connection successful!');
      } else {
        setDbResult({ success: false, error: data.error });
      }
    } catch (error) {
      setDbResult({ success: false, error: 'Could not connect to backend to test database.' });
    } finally {
      setTestingDb(false);
    }
  };

  const handleComplete = () => {
    toast.success('Setup completed! You can now use GIS tools.');
    onComplete?.();
    onOpenChange(false);
    setStep(1);
    setConnectionResult(null);
    setDetectedPythons([]);
    setSelectedPython(null);
    setDbResult(null);
  };

  const handleSkip = () => {
    toast.info('Setup skipped. You can configure the backend later in Settings.');
    onOpenChange(false);
    setStep(1);
    setConnectionResult(null);
    setDetectedPythons([]);
    setSelectedPython(null);
    setDbResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  s < step
                    ? 'bg-primary text-primary-foreground'
                    : s === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-6 h-0.5 mx-0.5 ${
                    s < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[240px]">
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
              <h3 className="font-medium flex items-center gap-2">
                <FolderSearch className="w-5 h-5" />
                Python Path Detection
              </h3>
              <p className="text-sm text-muted-foreground">
                Scan your server for ArcGIS Pro Python installations.
              </p>

              <Button 
                onClick={detectPythonPaths} 
                disabled={detecting}
                className="w-full"
              >
                {detecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning for Python installations...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Auto-Detect Python Paths
                  </>
                )}
              </Button>

              {detectedPythons.length > 0 && (
                <div className="space-y-2">
                  <Label>Detected Python Installations:</Label>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {detectedPythons.map((python, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPython === python.path
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedPython(python.path)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {selectedPython === python.path && (
                                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                              <span className={`text-xs font-medium ${python.hasArcpy ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                {python.hasArcpy ? '✓ ArcPy Available' : 'No ArcPy'}
                              </span>
                              {python.version && (
                                <span className="text-xs text-muted-foreground">
                                  v{python.version}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-muted-foreground truncate mt-1">
                              {python.path}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0 h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(python.path);
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detectedPythons.length === 0 && !detecting && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Common ArcGIS Pro Python paths:</p>
                  <div className="space-y-1 text-xs text-muted-foreground font-mono">
                    <p>C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe</p>
                    <p>C:\Program Files\ArcGIS\Pro\bin\Python\python3.exe</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Set the <code className="bg-muted px-1 rounded">ARCPY_PYTHON_PATH</code> environment variable on your server.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Configuration
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure where to store user accounts, configurations, and job history.
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Database Type</Label>
                  <Select
                    value={dbConfig.type}
                    onValueChange={(value: 'sqlite' | 'sqlserver') => {
                      setDbConfig({ ...dbConfig, type: value });
                      setDbResult(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sqlite">SQLite (Local File)</SelectItem>
                      <SelectItem value="sqlserver">SQL Server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dbConfig.type === 'sqlserver' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-server">Server</Label>
                        <Input
                          id="db-server"
                          placeholder="localhost or IP address"
                          value={dbConfig.server}
                          onChange={(e) => setDbConfig({ ...dbConfig, server: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-name">Database Name</Label>
                        <Input
                          id="db-name"
                          placeholder="GIS_Hub"
                          value={dbConfig.database}
                          onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="db-user">Username</Label>
                        <Input
                          id="db-user"
                          placeholder="sa"
                          value={dbConfig.user}
                          onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-password">Password</Label>
                        <Input
                          id="db-password"
                          type="password"
                          placeholder="••••••••"
                          value={dbConfig.password}
                          onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="encrypt"
                          checked={dbConfig.encrypt}
                          onCheckedChange={(checked) => setDbConfig({ ...dbConfig, encrypt: !!checked })}
                        />
                        <Label htmlFor="encrypt" className="text-sm">Encrypt Connection</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="trustCert"
                          checked={dbConfig.trustCert}
                          onCheckedChange={(checked) => setDbConfig({ ...dbConfig, trustCert: !!checked })}
                        />
                        <Label htmlFor="trustCert" className="text-sm">Trust Server Certificate</Label>
                      </div>
                    </div>
                  </>
                )}

                <Button 
                  onClick={testDbConnection} 
                  disabled={testingDb}
                  className="w-full mt-2"
                  variant={dbConfig.type === 'sqlite' ? 'secondary' : 'default'}
                >
                  {testingDb ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    dbConfig.type === 'sqlite' ? 'Use SQLite (Default)' : 'Test SQL Server Connection'
                  )}
                </Button>

                {dbResult && (
                  <div
                    className={`p-3 rounded-lg ${
                      dbResult.success
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {dbResult.success ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      )}
                      <p className="text-sm">
                        {dbResult.success ? dbResult.message : dbResult.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {dbConfig.type === 'sqlite' && (
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  SQLite stores data in a local file (<code>gis_hub.db</code>). Good for single-user or development setups.
                </div>
              )}
            </div>
          )}

          {step === 5 && (
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
                          <p className="text-xs">
                            Python path: <code className="bg-muted px-1 rounded">{connectionResult.pythonPath}</code>
                          </p>
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
              <Button onClick={() => step === 3 && selectedPython ? applyPythonPath() : setStep(step + 1)}>
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