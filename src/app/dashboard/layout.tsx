'use client';

import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard,
  Users,
  Calendar, 
  Plus, 
  Settings, 
  LogOut,
  Menu,
  X,
  Camera,
  ShieldAlert,
  DollarSign,
  Sun,
  Moon,
  Activity,
  Fingerprint,
  Receipt
} from 'lucide-react';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/events/new', label: 'Create Event', icon: Plus },
];

const adminLinks = [
  { href: '/dashboard/users', label: 'Users', icon: Users, permission: 'manageUsers' },
  { href: '/dashboard/all-events', label: 'All Events', icon: Calendar, permission: 'manageEvents' },
  { href: '/dashboard/payouts', label: 'Payouts', icon: DollarSign, permission: 'managePayouts' },
  { href: '/dashboard/transactions', label: 'Transaksi Foto', icon: Receipt, permission: 'managePayouts' },
  { href: '/dashboard/claims', label: 'Klaim Manual', icon: Fingerprint, permission: 'manageUsers' },
  { href: '/dashboard/logs', label: 'Aktivitas (Axiom)', icon: Activity, permission: 'manageLogs' },
  { href: '/dashboard/admins', label: 'Admins', icon: ShieldAlert, superadminOnly: true },
];

const accountLinks = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    console.log('[DEBUG-DASHBOARD-LAYOUT] useSession:', { status, session });
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }
    if (status === 'authenticated') {
      const role = session?.user?.role;
      
      // Block photographer access - only admin/superadmin allowed
      if (role === 'photographer' || role === 'user') {
        router.push('/');
        return;
      }

      if (role === 'admin') {
        const p = session?.user?.permissions;
        const hasPermission =
          !!p && (p.manageUsers || p.manageEvents || p.managePayouts || p.manageLogs);
        if (!hasPermission) {
          router.push('/');
          return;
        }
      }

      if (role !== 'admin' && role !== 'superadmin') {
        router.push('/');
        return;
      }
    }
  }, [status, session, router]);

  // Get current theme on mount
  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light');
    const timer = setTimeout(() => {
      setTheme(isLight ? 'light' : 'dark');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSidebarOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  const hasAccess = !!session?.user && (
    session.user.role === 'superadmin' || 
    session.user.role === 'admin'
  );

  const isSuperadmin = session?.user?.role === 'superadmin';
  const canManageUsers = isSuperadmin || !!session?.user?.permissions?.manageUsers;
  const canManageEvents = isSuperadmin || !!session?.user?.permissions?.manageEvents;
  const canManagePayouts = isSuperadmin || !!session?.user?.permissions?.managePayouts;
  const canManageLogs = isSuperadmin || !!session?.user?.permissions?.manageLogs;

  // Don't block navigation or crash if session is loading or not loaded
  if (status === 'loading' || !session || !session.user) {
    return (
      <div className="min-h-screen flex bg-neutral-950">
        <aside className="w-72 bg-neutral-900/95 border-r border-neutral-800 p-4 animate-pulse">
          <div className="space-y-4">
            <div className="h-10 bg-neutral-800 rounded-xl" />
            <div className="h-10 bg-neutral-800 rounded-xl" />
            <div className="h-10 bg-neutral-800 rounded-xl" />
          </div>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-neutral-900 rounded w-1/3" />
            <div className="h-64 bg-neutral-900 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (status === 'authenticated' && !hasAccess) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex bg-neutral-950 text-neutral-100">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 z-50">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-md">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-neutral-50">
            FotoMe
          </span>
        </Link>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800 rounded-lg transition"
          aria-label="Toggle menu"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fadeIn"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen
        w-72 bg-neutral-900/95 backdrop-blur-md border-r border-neutral-800
        flex flex-col
        transition-transform duration-300 ease-in-out
        z-50 md:z-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Logo - Desktop only */}
        <div className="hidden md:flex items-center gap-2 p-6 border-b border-neutral-800">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shadow-md">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-neutral-50">
              FotoMe
            </span>
          </Link>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Mobile: User Card at top */}
          <div className="md:hidden pt-12">
            <div className="flex items-center gap-3 p-3 bg-neutral-950/40 border border-neutral-850 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary-500 to-accent-500 flex items-center justify-center font-bold text-white text-base shrink-0">
                {session?.user?.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={session?.user?.image} alt={session?.user?.name || ''} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>{session?.user?.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-neutral-50 truncate leading-snug">{session?.user?.name}</p>
                <p className="text-xs text-neutral-500 truncate">{session?.user?.email}</p>
                <span className="inline-block text-[9px] font-bold uppercase rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/20 px-2 py-0.5 tracking-wider mt-1">
                  {session?.user?.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                </span>
              </div>
            </div>
          </div>

          {/* Dashboard Links */}
          <nav className="space-y-1">
            <p className="text-xs font-bold uppercase text-neutral-600 px-3 mb-2 tracking-wider">Dashboard</p>
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                    isActive 
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                      : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Admin Links */}
          {(isSuperadmin || canManageUsers || canManageEvents || canManagePayouts || canManageLogs) && (
            <nav className="space-y-1">
              <div className="border-t border-neutral-800 my-3" />
              <p className="text-xs font-bold uppercase text-neutral-600 px-3 mb-2 tracking-wider">Admin</p>
              {adminLinks.map((link) => {
                // Check permission
                if (link.superadminOnly && !isSuperadmin) return null;
                if (link.permission === 'manageUsers' && !canManageUsers) return null;
                if (link.permission === 'manageEvents' && !canManageEvents) return null;
                if (link.permission === 'managePayouts' && !canManagePayouts) return null;
                if (link.permission === 'manageLogs' && !canManageLogs) return null;

                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                      isActive 
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                        : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Account Links */}
          <nav className="space-y-1">
            <div className="border-t border-neutral-800 my-3" />
            <p className="text-xs font-bold uppercase text-neutral-600 px-3 mb-2 tracking-wider">Account</p>
            {accountLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                    isActive 
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                      : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-neutral-800 space-y-2">
          {/* Desktop: User Card */}
          <div className="hidden md:block">
            <div className="flex items-center gap-3 p-3 bg-neutral-950/40 border border-neutral-850 rounded-xl mb-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-accent-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                {session?.user?.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={session?.user?.image} alt={session?.user?.name || ''} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>{session?.user?.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-neutral-50 truncate leading-snug">{session?.user?.name}</p>
                <span className="inline-block text-[9px] font-bold uppercase rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/20 px-2 py-0.5 tracking-wider mt-1">
                  {session?.user?.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                </span>
              </div>
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="bg-neutral-950/40 border border-neutral-850 rounded-xl p-1 flex items-center gap-1 mb-2">
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition duration-150 ${
                theme === 'dark'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10'
                  : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition duration-150 ${
                theme === 'light'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10'
                  : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition duration-150 w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden pt-16 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
