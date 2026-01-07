import { useState, useEffect } from 'react';
import { Loader2, Layers, Table, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface FeatureClass {
  name: string;
  type: string;
  feature_count: number;
  spatial_reference?: string;
}

interface FeatureClassSelectorProps {
  gdbPath: string;
  selectedFeatureClasses: string[];
  onSelectionChange: (selected: string[]) => void;
  className?: string;
}

export function FeatureClassSelector({
  gdbPath,
  selectedFeatureClasses,
  onSelectionChange,
  className,
}: FeatureClassSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureClasses, setFeatureClasses] = useState<FeatureClass[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [pythonBackendUrl] = useLocalStorage('python-backend-url', '');

  const fetchFeatureClasses = async () => {
    if (!gdbPath || !pythonBackendUrl) {
      setFeatureClasses([]);
      setTables([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${pythonBackendUrl}/list-feature-classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gdbPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.detail || 'Failed to list feature classes');
      }

      const data = await response.json();
      setFeatureClasses(data.feature_classes || []);
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature classes');
      setFeatureClasses([]);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gdbPath && gdbPath.toLowerCase().endsWith('.gdb')) {
      fetchFeatureClasses();
    } else {
      setFeatureClasses([]);
      setTables([]);
    }
  }, [gdbPath, pythonBackendUrl]);

  const handleToggle = (name: string) => {
    if (selectedFeatureClasses.includes(name)) {
      onSelectionChange(selectedFeatureClasses.filter((fc) => fc !== name));
    } else {
      onSelectionChange([...selectedFeatureClasses, name]);
    }
  };

  const handleSelectAll = () => {
    const allNames = featureClasses.map((fc) => fc.name);
    onSelectionChange(allNames);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const getGeometryIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'polygon':
        return '⬡';
      case 'polyline':
        return '⟿';
      case 'point':
        return '●';
      default:
        return '◆';
    }
  };

  if (!gdbPath) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">
            Select a geodatabase to view feature classes
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!pythonBackendUrl) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">
            Configure Python backend URL in Settings to list feature classes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Feature Classes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFeatureClasses}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={fetchFeatureClasses}
            >
              Retry
            </Button>
          </div>
        ) : featureClasses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No feature classes found
          </p>
        ) : (
          <div className="space-y-3">
            {/* Selection controls */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selectedFeatureClasses.length} of {featureClasses.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleDeselectAll}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Feature class list */}
            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-1">
                {featureClasses.map((fc) => (
                  <label
                    key={fc.name}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                      'hover:bg-muted',
                      selectedFeatureClasses.includes(fc.name) && 'bg-primary/5'
                    )}
                  >
                    <Checkbox
                      checked={selectedFeatureClasses.includes(fc.name)}
                      onCheckedChange={() => handleToggle(fc.name)}
                    />
                    <span className="text-lg" title={fc.type}>
                      {getGeometryIcon(fc.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fc.feature_count.toLocaleString()} features
                        {fc.spatial_reference && ` • ${fc.spatial_reference}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {fc.type}
                    </Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>

            {/* Tables section */}
            {tables.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Table className="w-3 h-3" />
                  Tables ({tables.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {tables.map((table) => (
                    <Badge key={table} variant="secondary" className="text-xs">
                      {table}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
