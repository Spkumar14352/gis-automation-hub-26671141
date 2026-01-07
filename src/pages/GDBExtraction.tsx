import { useState } from 'react';
import { Database, Play, RotateCcw, Download, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { PathInput } from '@/components/common/PathInput';
import { ConsolePanel } from '@/components/common/ConsolePanel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ResultsTable } from '@/components/common/ResultsTable';
import { FeatureClassSelector } from '@/components/common/FeatureClassSelector';
import { useExecutionSimulator } from '@/hooks/useExecutionSimulator';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ExtractedFile {
  name: string;
  type: string;
  features: number;
  size: string;
}

const simulatedLogs = [
  { type: 'info' as const, message: 'Initializing GDB extraction process...', delay: 300 },
  { type: 'info' as const, message: 'Connecting to source geodatabase...', delay: 500 },
  { type: 'success' as const, message: 'Connection established successfully', delay: 400 },
  { type: 'info' as const, message: 'Scanning feature classes...', delay: 600 },
  { type: 'info' as const, message: 'Found 5 feature classes, 3 tables', delay: 400 },
  { type: 'info' as const, message: 'Extracting: Parcels (12,456 features)...', delay: 800 },
  { type: 'success' as const, message: 'Parcels extracted successfully', delay: 300 },
  { type: 'info' as const, message: 'Extracting: Roads (8,234 features)...', delay: 700 },
  { type: 'success' as const, message: 'Roads extracted successfully', delay: 300 },
  { type: 'info' as const, message: 'Extracting: Buildings (15,678 features)...', delay: 900 },
  { type: 'success' as const, message: 'Buildings extracted successfully', delay: 300 },
  { type: 'info' as const, message: 'Extracting: Utilities (4,521 features)...', delay: 600 },
  { type: 'success' as const, message: 'Utilities extracted successfully', delay: 300 },
  { type: 'info' as const, message: 'Extracting: Zoning (2,345 features)...', delay: 500 },
  { type: 'success' as const, message: 'Zoning extracted successfully', delay: 300 },
  { type: 'info' as const, message: 'Generating output files...', delay: 400 },
  { type: 'success' as const, message: 'Extraction complete! 5 files created.', delay: 300 },
];

const mockResults: ExtractedFile[] = [
  { name: 'Parcels.shp', type: 'Polygon', features: 12456, size: '24.5 MB' },
  { name: 'Roads.shp', type: 'Polyline', features: 8234, size: '18.2 MB' },
  { name: 'Buildings.shp', type: 'Polygon', features: 15678, size: '32.1 MB' },
  { name: 'Utilities.shp', type: 'Polyline', features: 4521, size: '8.7 MB' },
  { name: 'Zoning.shp', type: 'Polygon', features: 2345, size: '5.4 MB' },
];

export default function GDBExtraction() {
  const [config, setConfig] = useLocalStorage('gdb-extraction-config', {
    sourceGdbPath: '',
    outputFolder: '',
    selectedFeatureClasses: [] as string[],
  });
  const [results, setResults] = useState<ExtractedFile[]>([]);
  const { status, logs, execute, reset } = useExecutionSimulator();

  const handleExecute = async () => {
    if (!config.sourceGdbPath || !config.outputFolder) return;
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
    { key: 'name', header: 'File Name', className: 'font-mono' },
    { key: 'type', header: 'Geometry Type' },
    { key: 'features', header: 'Features', className: 'text-right' },
    { key: 'size', header: 'Size', className: 'text-right' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={Database}
        title="GDB Extraction"
        description="Extract feature classes from a File Geodatabase to individual shapefiles"
        actions={<StatusBadge status={status} />}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PathInput
              label="Source Geodatabase"
              value={config.sourceGdbPath}
              onChange={(value) => setConfig({ ...config, sourceGdbPath: value, selectedFeatureClasses: [] })}
              placeholder="C:\Data\MyDatabase.gdb"
              type="database"
              description="Path to the source File Geodatabase (.gdb)"
            />

            <FeatureClassSelector
              gdbPath={config.sourceGdbPath}
              selectedFeatureClasses={config.selectedFeatureClasses}
              onSelectionChange={(selected) => setConfig({ ...config, selectedFeatureClasses: selected })}
            />

            <PathInput
              label="Output Folder"
              value={config.outputFolder}
              onChange={(value) => setConfig({ ...config, outputFolder: value })}
              placeholder="C:\Output\Shapefiles"
              description="Destination folder for extracted files"
            />

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleExecute}
                disabled={status === 'running' || !config.sourceGdbPath || !config.outputFolder}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute Extraction
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={status === 'running'}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Console Panel */}
        <ConsolePanel logs={logs} onClear={handleReset} className="h-fit" />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Extracted Files
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </CardHeader>
          <CardContent>
            <ResultsTable data={results} columns={columns} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
