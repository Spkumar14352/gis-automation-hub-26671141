import { useState, useEffect } from 'react';
import { Folder, Database, Info, ChevronRight, ChevronUp, HardDrive, Loader2, Server } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { supabase } from '@/integrations/supabase/client';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface PathInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'folder' | 'database';
  description?: string;
  className?: string;
}

interface FileItem {
  name: string;
  path: string;
  type: 'gdb' | 'sde' | 'folder' | 'file';
  size?: number;
  modified?: string;
}

interface BrowseResponse {
  current_path: string;
  parent_path: string | null;
  items: FileItem[];
  drives?: string[];
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [pythonBackendUrl] = useLocalStorage('python-backend-url', '');

  const browseFilesystem = async (path: string = '') => {
    if (!pythonBackendUrl) {
      setError('Python backend URL not configured. Go to Settings to configure it.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('browse-filesystem', {
        body: { 
          path, 
          pythonBackendUrl,
          type: type === 'database' ? 'gdb' : 'folder'
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      setBrowseData(data);
      setCurrentPath(data.current_path || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to browse filesystem';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setBrowseData(null);
      setError(null);
      browseFilesystem('');
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      browseFilesystem(item.path);
    } else {
      onChange(item.path);
      setOpen(false);
    }
  };

  const handleNavigateUp = () => {
    if (browseData?.parent_path) {
      browseFilesystem(browseData.parent_path);
    } else {
      browseFilesystem('');
    }
  };

  const handleSelectCurrent = () => {
    if (currentPath) {
      onChange(currentPath);
      setOpen(false);
    }
  };

  const getItemIcon = (itemType: FileItem['type']) => {
    switch (itemType) {
      case 'gdb':
        return <Database className="w-4 h-4 text-primary" />;
      case 'sde':
        return <Server className="w-4 h-4 text-accent" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Folder className="w-4 h-4 text-muted-foreground" />;
    }
  };

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
              Enter the path as it exists on your Python/ArcPy server, 
              or use the browse button to navigate the server filesystem.
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
        <Dialog open={open} onOpenChange={handleOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon" className="shrink-0">
              <Folder className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Browse Server Filesystem</DialogTitle>
              <DialogDescription>
                Navigate to select a {type === 'database' ? 'geodatabase or SDE connection' : 'folder'}
              </DialogDescription>
            </DialogHeader>

            {!pythonBackendUrl ? (
              <div className="p-6 text-center">
                <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium mb-2">Python Backend Not Configured</p>
                <p className="text-sm text-muted-foreground mb-4">
                  To browse server files, configure your Python backend URL in Settings.
                </p>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p className="text-sm">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => browseFilesystem('')}
                >
                  Retry
                </Button>
              </div>
            ) : browseData ? (
              <div className="space-y-3">
                {/* Current Path */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm truncate flex-1">
                    {currentPath || 'Select a drive'}
                  </span>
                  {currentPath && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNavigateUp}
                    >
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Up
                    </Button>
                  )}
                </div>

                {/* File List */}
                <ScrollArea className="h-[300px] border rounded-lg">
                  {browseData.items.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No items found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {browseData.items.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                            'hover:bg-muted',
                            item.type === 'gdb' && 'bg-primary/5 hover:bg-primary/10',
                            item.type === 'sde' && 'bg-accent/5 hover:bg-accent/10'
                          )}
                        >
                          {getItemIcon(item.type)}
                          <span className="flex-1 truncate text-sm">{item.name}</span>
                          {item.type === 'folder' && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          {(item.type === 'gdb' || item.type === 'sde') && (
                            <span className="text-xs text-muted-foreground uppercase">
                              {item.type}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Actions */}
                {type === 'folder' && currentPath && (
                  <Button onClick={handleSelectCurrent} className="w-full">
                    Select This Folder
                  </Button>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
