import { Settings as SettingsIcon, Moon, Sun, Trash2, Server, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common/PageHeader';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export default function Settings() {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [pythonBackendUrl, setPythonBackendUrl] = useLocalStorage('python-backend-url', '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleClearCache = () => {
    const keys = ['gdb-extraction-config', 'sde-conversion-config', 'comparison-config'];
    keys.forEach((key) => localStorage.removeItem(key));
    toast.success('Configuration cache cleared');
  };

  const testConnection = async () => {
    if (!pythonBackendUrl) {
      toast.error('Please enter a backend URL first');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const response = await fetch(`${pythonBackendUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('success');
        toast.success(`Connected! ArcPy: ${data.arcpy_available ? 'Available' : 'Not installed'}`);
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Could not connect to Python backend');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Configure application preferences and backend connection"
      />

      <div className="max-w-2xl space-y-6">
        {/* Python Backend Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="w-5 h-5" />
              Python Backend
            </CardTitle>
            <CardDescription>
              Connect to your ArcPy server to enable script execution and file browsing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backend-url">Backend URL</Label>
              <div className="flex gap-2">
                <Input
                  id="backend-url"
                  value={pythonBackendUrl}
                  onChange={(e) => {
                    setPythonBackendUrl(e.target.value);
                    setConnectionStatus('idle');
                  }}
                  placeholder="http://your-server:8000"
                  className="font-mono"
                />
                <Button 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={testingConnection || !pythonBackendUrl}
                >
                  {testingConnection ? (
                    'Testing...'
                  ) : connectionStatus === 'success' ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-success" />
                      Connected
                    </>
                  ) : (
                    'Test'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                URL of your Python FastAPI server running the GIS backend
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <p className="text-sm font-medium">Setup Instructions:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Download the Python backend template from this app</li>
                <li>Install on a machine with ArcGIS Pro (for ArcPy access)</li>
                <li>Run: <code className="bg-muted px-1 rounded">pip install fastapi uvicorn requests</code></li>
                <li>Start: <code className="bg-muted px-1 rounded">uvicorn gis_backend:app --host 0.0.0.0 --port 8000</code></li>
                <li>Enter the server URL above and test the connection</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="/python-backend/gis_backend.py" download="gis_backend.py">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Download Python Backend
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
            <CardDescription>Customize the visual appearance of the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <div>
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    {darkMode ? 'Dark theme is enabled' : 'Light theme is enabled'}
                  </p>
                </div>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Management</CardTitle>
            <CardDescription>Manage stored configurations and cached data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <Label>Clear Configuration Cache</Label>
                <p className="text-sm text-muted-foreground">
                  Remove all saved paths and settings from local storage
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleClearCache}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">GIS Automation Hub</strong> v1.0.0</p>
              <p>A centralized interface for running GIS automation scripts.</p>
              <p className="text-xs mt-4">
                This web app connects to your Python/ArcPy backend server to execute
                GDB extraction, SDE migration, and feature class comparison scripts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
