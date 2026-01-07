import { useState } from 'react';
import { ArrowLeftRight, Play, RotateCcw, Download, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/PageHeader';
import { PathInput } from '@/components/common/PathInput';
import { ConsolePanel } from '@/components/common/ConsolePanel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ResultsTable } from '@/components/common/ResultsTable';
import { useExecutionSimulator } from '@/hooks/useExecutionSimulator';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface MigrationResult {
  name: string;
  sourceCount: number;
  targetCount: number;
  status: 'success' | 'warning' | 'error';
}

const availableFeatureClasses = [
  { id: 'parcels', name: 'Parcels', count: 12456 },
  { id: 'roads', name: 'Roads', count: 8234 },
  { id: 'buildings', name: 'Buildings', count: 15678 },
  { id: 'utilities', name: 'Utilities', count: 4521 },
  { id: 'zoning', name: 'Zoning', count: 2345 },
  { id: 'hydrology', name: 'Hydrology', count: 3456 },
];

const simulatedLogs = [
  { type: 'info' as const, message: 'Initializing SDE to SDE migration...', delay: 300 },
  { type: 'info' as const, message: 'Connecting to source SDE...', delay: 600 },
  { type: 'success' as const, message: 'Source connection established', delay: 400 },
  { type: 'info' as const, message: 'Connecting to target SDE...', delay: 500 },
  { type: 'success' as const, message: 'Target connection established', delay: 400 },
  { type: 'info' as const, message: 'Starting feature class migration...', delay: 300 },
  { type: 'info' as const, message: 'Migrating Parcels (12,456 rows)...', delay: 1000 },
  { type: 'success' as const, message: 'Parcels: 12,456 rows migrated', delay: 300 },
  { type: 'info' as const, message: 'Migrating Roads (8,234 rows)...', delay: 800 },
  { type: 'success' as const, message: 'Roads: 8,234 rows migrated', delay: 300 },
  { type: 'info' as const, message: 'Migrating Buildings (15,678 rows)...', delay: 1200 },
  { type: 'success' as const, message: 'Buildings: 15,678 rows migrated', delay: 300 },
  { type: 'info' as const, message: 'Verifying data integrity...', delay: 500 },
  { type: 'success' as const, message: 'Migration completed successfully!', delay: 300 },
];

const mockResults: MigrationResult[] = [
  { name: 'Parcels', sourceCount: 12456, targetCount: 12456, status: 'success' },
  { name: 'Roads', sourceCount: 8234, targetCount: 8234, status: 'success' },
  { name: 'Buildings', sourceCount: 15678, targetCount: 15678, status: 'success' },
];

export default function SDEConversion() {
  const [config, setConfig] = useLocalStorage('sde-conversion-config', {
    sourceConnection: '',
    targetConnection: '',
    selectedFeatureClasses: [] as string[],
  });
  const [results, setResults] = useState<MigrationResult[]>([]);
  const { status, logs, execute, reset } = useExecutionSimulator();

  const handleToggleFeatureClass = (id: string) => {
    const selected = config.selectedFeatureClasses.includes(id)
      ? config.selectedFeatureClasses.filter((fc) => fc !== id)
      : [...config.selectedFeatureClasses, id];
    setConfig({ ...config, selectedFeatureClasses: selected });
  };

  const handleSelectAll = () => {
    if (config.selectedFeatureClasses.length === availableFeatureClasses.length) {
      setConfig({ ...config, selectedFeatureClasses: [] });
    } else {
      setConfig({ ...config, selectedFeatureClasses: availableFeatureClasses.map((fc) => fc.id) });
    }
  };

  const handleExecute = async () => {
    if (!config.sourceConnection || !config.targetConnection || config.selectedFeatureClasses.length === 0) return;
    setResults([]);
    const success = await execute(simulatedLogs);
    if (success) {
      setResults(mockResults);
    }
  };

  const handleReset = () => {
    reset();
    setResults([]);
  };

  const columns = [
    { key: 'name', header: 'Feature Class', className: 'font-medium' },
    { key: 'sourceCount', header: 'Source Rows', className: 'text-right font-mono' },
    { key: 'targetCount', header: 'Target Rows', className: 'text-right font-mono' },
    {
      key: 'status',
      header: 'Status',
      render: (item: MigrationResult) => (
        <span className={`status-badge ${item.status === 'success' ? 'status-success' : 'status-failed'}`}>
          {item.status === 'success' ? 'Verified' : 'Mismatch'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={ArrowLeftRight}
        title="SDE to SDE Conversion"
        description="Migrate feature classes between Enterprise Geodatabases"
        actions={<StatusBadge status={status} />}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PathInput
                label="Source SDE Connection"
                value={config.sourceConnection}
                onChange={(value) => setConfig({ ...config, sourceConnection: value })}
                placeholder="server:5151/database@user"
                type="database"
                description="Connection string for source SDE"
              />
              <div className="flex items-center justify-center py-2">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <PathInput
                label="Target SDE Connection"
                value={config.targetConnection}
                onChange={(value) => setConfig({ ...config, targetConnection: value })}
                placeholder="server:5151/database@user"
                type="database"
                description="Connection string for target SDE"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Feature Classes</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {config.selectedFeatureClasses.length === availableFeatureClasses.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {availableFeatureClasses.map((fc) => (
                  <div
                    key={fc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={fc.id}
                        checked={config.selectedFeatureClasses.includes(fc.id)}
                        onCheckedChange={() => handleToggleFeatureClass(fc.id)}
                      />
                      <Label htmlFor={fc.id} className="font-medium cursor-pointer">
                        {fc.name}
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">
                      {fc.count.toLocaleString()} rows
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={handleExecute}
              disabled={
                status === 'running' ||
                !config.sourceConnection ||
                !config.targetConnection ||
                config.selectedFeatureClasses.length === 0
              }
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Migration
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={status === 'running'}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Console and Results */}
        <div className="space-y-6">
          <ConsolePanel logs={logs} onClear={handleReset} className="h-fit" />

          {results.length > 0 && (
            <Card className="animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Migration Summary</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Log
                </Button>
              </CardHeader>
              <CardContent>
                <ResultsTable data={results} columns={columns} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
