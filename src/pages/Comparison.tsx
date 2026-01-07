import { useState } from 'react';
import { GitCompare, Play, RotateCcw, Download, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageHeader } from '@/components/common/PageHeader';
import { PathInput } from '@/components/common/PathInput';
import { ConsolePanel } from '@/components/common/ConsolePanel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useExecutionSimulator } from '@/hooks/useExecutionSimulator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';

interface ComparisonResult {
  field: string;
  sourceValue: string;
  targetValue: string;
  match: boolean;
  difference?: string;
}

const comparisonTypes = [
  {
    id: 'schema',
    name: 'Schema Comparison',
    description: 'Compare field definitions, data types, and geometry types',
  },
  {
    id: 'attribute',
    name: 'Attribute Comparison',
    description: 'Compare attribute values and identify differences',
  },
  {
    id: 'spatial',
    name: 'Spatial Comparison',
    description: 'Compare geometry accuracy and topology',
  },
];

const simulatedLogs = [
  { type: 'info' as const, message: 'Starting feature class comparison...', delay: 300 },
  { type: 'info' as const, message: 'Loading source dataset...', delay: 500 },
  { type: 'success' as const, message: 'Source: 12,456 features loaded', delay: 400 },
  { type: 'info' as const, message: 'Loading target dataset...', delay: 500 },
  { type: 'success' as const, message: 'Target: 12,458 features loaded', delay: 400 },
  { type: 'warning' as const, message: 'Feature count mismatch detected (+2 in target)', delay: 300 },
  { type: 'info' as const, message: 'Comparing schema definitions...', delay: 600 },
  { type: 'success' as const, message: 'Schema: 15/15 fields match', delay: 400 },
  { type: 'info' as const, message: 'Comparing attribute values...', delay: 800 },
  { type: 'warning' as const, message: 'Found 23 records with attribute differences', delay: 300 },
  { type: 'info' as const, message: 'Generating comparison report...', delay: 500 },
  { type: 'success' as const, message: 'Comparison complete! Report generated.', delay: 300 },
];

const mockSchemaResults: ComparisonResult[] = [
  { field: 'OBJECTID', sourceValue: 'Integer', targetValue: 'Integer', match: true },
  { field: 'PARCEL_ID', sourceValue: 'String(20)', targetValue: 'String(20)', match: true },
  { field: 'OWNER_NAME', sourceValue: 'String(100)', targetValue: 'String(150)', match: false, difference: 'Length differs' },
  { field: 'AREA_SQFT', sourceValue: 'Double', targetValue: 'Double', match: true },
  { field: 'CREATED_DATE', sourceValue: 'Date', targetValue: 'DateTime', match: false, difference: 'Type differs' },
  { field: 'ZONING_CODE', sourceValue: 'String(10)', targetValue: 'String(10)', match: true },
  { field: 'SHAPE', sourceValue: 'Polygon', targetValue: 'Polygon', match: true },
];

export default function Comparison() {
  const [config, setConfig] = useLocalStorage('comparison-config', {
    sourceConnection: '',
    targetConnection: '',
    comparisonType: 'schema',
  });
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const { status, logs, execute, reset } = useExecutionSimulator();

  const handleExecute = async () => {
    if (!config.sourceConnection || !config.targetConnection) return;
    setResults([]);
    const success = await execute(simulatedLogs);
    if (success) {
      setResults(mockSchemaResults);
    }
  };

  const handleReset = () => {
    reset();
    setResults([]);
  };

  const matchCount = results.filter((r) => r.match).length;
  const mismatchCount = results.filter((r) => !r.match).length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        icon={GitCompare}
        title="Feature Class Comparison"
        description="Compare schema, attributes, or spatial properties between datasets"
        actions={<StatusBadge status={status} />}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Data Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PathInput
                label="Source Dataset"
                value={config.sourceConnection}
                onChange={(value) => setConfig({ ...config, sourceConnection: value })}
                placeholder="C:\Data\Source.gdb\FeatureClass"
                type="database"
                description="Source feature class or table"
              />
              <PathInput
                label="Target Dataset"
                value={config.targetConnection}
                onChange={(value) => setConfig({ ...config, targetConnection: value })}
                placeholder="C:\Data\Target.gdb\FeatureClass"
                type="database"
                description="Target feature class or table to compare against"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparison Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={config.comparisonType}
                onValueChange={(value) => setConfig({ ...config, comparisonType: value })}
                className="space-y-3"
              >
                {comparisonTypes.map((type) => (
                  <label
                    key={type.id}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                      config.comparisonType === type.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={type.id} id={type.id} className="mt-0.5" />
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={handleExecute}
              disabled={status === 'running' || !config.sourceConnection || !config.targetConnection}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Comparison
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
                <div>
                  <CardTitle className="text-lg">Comparison Results</CardTitle>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      {matchCount} matched
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-warning">
                      <AlertTriangle className="w-4 h-4" />
                      {mismatchCount} differences
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        result.match ? 'border-border bg-muted/30' : 'border-warning/30 bg-warning/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {result.match ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-warning" />
                        )}
                        <span className="font-mono font-medium">{result.field}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Source: <code className="text-foreground">{result.sourceValue}</code>
                        </span>
                        <span className="text-muted-foreground">
                          Target: <code className="text-foreground">{result.targetValue}</code>
                        </span>
                        {result.difference && (
                          <span className="text-warning text-xs">{result.difference}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
