import { Database, GitCompare, ArrowLeftRight, Map, Settings, ChevronLeft, History, LogOut, LayoutDashboard, User, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBackend } from '@/contexts/BackendContext';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  {
    title: 'Dashboard',
    description: 'Overview & quick actions',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'GDB Extraction',
    description: 'Extract from Geodatabase',
    icon: Database,
    path: '/gdb-extraction',
  },
  {
    title: 'SDE to SDE',
    description: 'Migrate feature classes',
    icon: ArrowLeftRight,
    path: '/sde-conversion',
  },
  {
    title: 'FC Comparison',
    description: 'Compare datasets',
    icon: GitCompare,
    path: '/comparison',
  },
  {
    title: 'Job History',
    description: 'View past executions',
    icon: History,
    path: '/history',
  },
  {
    title: 'Profile',
    description: 'Account settings',
    icon: User,
    path: '/profile',
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { status, checkConnection } = useBackend();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <Map className="w-4 h-4" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sidebar-foreground truncate">GIS Hub</h1>
            <p className="text-xs text-muted-foreground truncate">Automation Toolbox</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Backend Status */}
      <div className={cn('px-3 py-2 border-b border-sidebar-border', collapsed && 'px-2')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => checkConnection()}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors',
                status === 'connected' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                status === 'disconnected' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                status === 'checking' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
              )}
            >
              {status === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {status === 'connected' && <Wifi className="w-3.5 h-3.5" />}
              {status === 'disconnected' && <WifiOff className="w-3.5 h-3.5" />}
              {!collapsed && (
                <span className="truncate">
                  {status === 'checking' && 'Checking...'}
                  {status === 'connected' && 'Backend Connected'}
                  {status === 'disconnected' && 'Backend Offline'}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>
              {status === 'connected' && 'Backend is connected. Click to refresh.'}
              {status === 'disconnected' && 'Backend is offline. Click to retry.'}
              {status === 'checking' && 'Checking connection...'}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground',
            location.pathname === '/settings' && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </NavLink>

        {user && (
          <div className={cn('px-3 py-2', !collapsed && 'space-y-2')}>
            {!collapsed && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className={cn(
                'w-full justify-start text-muted-foreground hover:text-foreground',
                collapsed && 'px-0 justify-center'
              )}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
