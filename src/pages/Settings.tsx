import { Settings as SettingsIcon, Moon, Sun, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common/PageHeader';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function Settings() {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Configure application preferences and manage cached data"
      />

      <div className="max-w-2xl space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">GIS Automation Hub</strong> v1.0.0</p>
              <p>A centralized interface for running GIS automation scripts.</p>
              <p className="text-xs mt-4">
                Note: This is a frontend demonstration. Actual Python script execution requires 
                a backend server (Flask/FastAPI) connected to an ArcPy-compatible environment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
