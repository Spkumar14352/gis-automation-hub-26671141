import { useState } from 'react';
import { Folder, Database, Info, ChevronRight, ChevronUp, HardDrive, Loader2, Server, Monitor } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [browseMode, setBrowseMode] = useState<'local' | 'server'>('local');
  const [pathPromptOpen, setPathPromptOpen] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');
  const [fullPathInput, setFullPathInput] = useState('');

  // Check if File System Access API is supported
  const isFileSystemSupported = 'showDirectoryPicker' in window;

  const browseLocalFilesystem = async () => {
    if (!isFileSystemSupported) {
      setError('Your browser does not support local file browsing. Use Chrome or Edge.');
      return;
    }

    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });
      
      // Get the full path - note: for security, browsers only give us the folder name
      // The user will need to note the full path themselves or we construct from selection
      const path = dirHandle.name;
      
      // Check if it's a .gdb folder
      if (type === 'database' && path.endsWith('.gdb')) {
        onChange(path);
        setOpen(false);
        return;
      }

      // List contents to help user navigate
      const items: FileItem[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          const isGdb = entry.name.endsWith('.gdb');
          items.push({
            name: entry.name,
            path: entry.name,
            type: isGdb ? 'gdb' : 'folder',
          });
        }
      }

      // Sort: GDBs first, then folders
      items.sort((a, b) => {
        if (a.type === 'gdb' && b.type !== 'gdb') return -1;
        if (a.type !== 'gdb' && b.type === 'gdb') return 1;
        return a.name.localeCompare(b.name);
      });

      setBrowseData({
        current_path: path,
        parent_path: null,
        items,
      });
      setCurrentPath(path);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled
        return;
      }
      setError('Failed to browse local filesystem');
    }
  };

  const browseServerFilesystem = async (path: string = '') => {
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
      if (browseMode === 'server' && pythonBackendUrl) {
        browseServerFilesystem('');
      }
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder' && browseMode === 'server') {
      browseServerFilesystem(item.path);
    } else if (item.type === 'gdb' || item.type === 'sde') {
      // For local mode, we need user to provide full path via modal
      if (browseMode === 'local') {
        setPendingItemName(item.name);
        setFullPathInput(`C:\\GIS\\Data\\${item.name}`);
        setPathPromptOpen(true);
      } else {
        onChange(item.path);
        setOpen(false);
      }
    }
  };

  const handlePathConfirm = () => {
    if (fullPathInput.trim()) {
      onChange(fullPathInput.trim());
      setPathPromptOpen(false);
      setOpen(false);
    }
  };

  const handleNavigateUp = () => {
    if (browseMode === 'server') {
      if (browseData?.parent_path) {
        browseServerFilesystem(browseData.parent_path);
      } else {
        browseServerFilesystem('');
      }
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
              <DialogTitle>Browse Filesystem</DialogTitle>
              <DialogDescription>
                Select a {type === 'database' ? 'geodatabase (.gdb) or SDE connection' : 'folder'}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={browseMode} onValueChange={(v) => {
              setBrowseMode(v as 'local' | 'server');
              setBrowseData(null);
              setError(null);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local" className="gap-2">
                  <Monitor className="w-4 h-4" />
                  Local
                </TabsTrigger>
                <TabsTrigger value="server" className="gap-2">
                  <Server className="w-4 h-4" />
                  Server
                </TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-4 mt-4">
                {isFileSystemSupported ? (
                  <>
                    <div className="text-center py-4">
                      <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Browse your local computer to find GDB files
                      </p>
                      <Button onClick={browseLocalFilesystem}>
                        <Folder className="w-4 h-4 mr-2" />
                        Select Folder
                      </Button>
                    </div>

                    {browseData && browseMode === 'local' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                          <HardDrive className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm truncate flex-1">
                            {currentPath}
                          </span>
                        </div>

                        <ScrollArea className="h-[200px] border rounded-lg">
                          {browseData.items.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                              No GDB files found in this folder
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
                                    item.type === 'gdb' && 'bg-primary/5 hover:bg-primary/10'
                                  )}
                                >
                                  {getItemIcon(item.type)}
                                  <span className="flex-1 truncate text-sm">{item.name}</span>
                                  {item.type === 'gdb' && (
                                    <span className="text-xs text-muted-foreground uppercase">GDB</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>

                        <p className="text-xs text-muted-foreground">
                          Note: You'll need to enter the full path when selecting a GDB.
                        </p>
                      </div>
                    )}

                    {error && browseMode === 'local' && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium mb-1">Local Browsing Not Supported</p>
                    <p className="text-sm text-muted-foreground">
                      Use Chrome or Edge browser to browse local files, or enter the path manually.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="server" className="space-y-4 mt-4">
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
                ) : error && browseMode === 'server' ? (
                  <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                    <p className="text-sm">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => browseServerFilesystem('')}
                    >
                      Retry
                    </Button>
                  </div>
                ) : browseData && browseMode === 'server' ? (
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
                    <ScrollArea className="h-[250px] border rounded-lg">
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
                ) : (
                  <div className="text-center py-6">
                    <Button onClick={() => browseServerFilesystem('')}>
                      <Server className="w-4 h-4 mr-2" />
                      Browse Server Files
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Path Input Modal for Local GDB Selection */}
        <Dialog open={pathPromptOpen} onOpenChange={setPathPromptOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Full Path</DialogTitle>
              <DialogDescription>
                Enter the complete path to <span className="font-mono font-medium">{pendingItemName}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="full-path">Full Path</Label>
                <Input
                  id="full-path"
                  value={fullPathInput}
                  onChange={(e) => setFullPathInput(e.target.value)}
                  placeholder="C:\GIS\Data\YourDatabase.gdb"
                  className="font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePathConfirm();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The browser cannot access the full path for security reasons. Please enter the complete path.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPathPromptOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePathConfirm} disabled={!fullPathInput.trim()}>
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
