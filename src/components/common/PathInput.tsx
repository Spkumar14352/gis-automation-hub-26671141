import { Folder, Database, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PathInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'folder' | 'database';
  description?: string;
  className?: string;
}

export function PathInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'folder',
  description,
  className,
}: PathInputProps) {
  const Icon = type === 'database' ? Database : Folder;

  const examplePaths = type === 'database' 
    ? [
        'C:\\Data\\MyDatabase.gdb',
        'D:\\GIS\\Projects\\CityData.gdb',
        '\\\\server\\share\\Enterprise.sde',
        'sde:sqlserver:SERVER\\INSTANCE',
      ]
    : [
        'C:\\Output\\Shapefiles',
        'D:\\GIS\\Exports',
        '\\\\server\\share\\Output',
      ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              Enter the path as it exists on your Python/ArcPy server. 
              This web app sends commands to your backend server which has access to these paths.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pl-10 font-mono text-sm"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon" className="shrink-0">
              <Folder className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Server-Side Paths</DialogTitle>
              <DialogDescription>
                This is a web-based interface that connects to a Python/ArcPy backend server.
                Enter paths as they exist on your server machine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-2">How it works:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Enter the path to your GDB/SDE on the server</li>
                  <li>This web app sends the request to your Python backend</li>
                  <li>The Python backend (with ArcPy) processes the data</li>
                  <li>Results are streamed back to this interface</li>
                </ol>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Example paths:</p>
                <div className="space-y-1">
                  {examplePaths.map((path, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        onChange(path);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors font-mono text-xs truncate"
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> To enable file browsing, 
                  configure your Python backend to expose a file listing API endpoint.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
