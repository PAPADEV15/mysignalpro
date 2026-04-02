import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Activity, Signal, List, Settings, Shield, LogOut, TrendingUp, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'analyst', 'viewer'] },
  { path: '/signals', label: 'Signals', icon: Signal, roles: ['admin', 'analyst', 'viewer'] },
  { path: '/analysis-runs', label: 'Analysis', icon: Activity, roles: ['admin', 'analyst', 'viewer'] },
  { path: '/metrics', label: 'Metrics', icon: PieChart, roles: ['admin', 'analyst', 'viewer'] },
  { path: '/watchlist', label: 'Watchlist', icon: List, roles: ['admin'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { path: '/audit', label: 'Audit', icon: Shield, roles: ['admin'] },
];

export function AppLayout() {
  const { user, roles, signOut, isAdmin } = useAuth();
  const location = useLocation();

  const visibleNav = navItems.filter(item =>
    item.roles.some(r => roles.includes(r as any) || isAdmin)
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-sm font-bold text-foreground">Crypto Intraday</h1>
              <p className="text-xs text-muted-foreground">Analyst</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {visibleNav.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 truncate">{user?.email}</div>
          <div className="text-xs text-muted-foreground mb-2">
            Role: <span className="text-primary capitalize">{roles[0] || 'viewer'}</span>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
