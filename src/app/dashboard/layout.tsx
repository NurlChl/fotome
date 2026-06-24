'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Calendar, Plus, Settings } from 'lucide-react';

const sidebarLinks = [
  { href: '/dashboard', label: 'My Events', icon: Calendar },
  { href: '/dashboard/events/new', label: 'Create Event', icon: Plus },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }
    if (status === 'authenticated') {
      const role = session?.user?.role;
      const hasPermission = session?.user?.permissions?.manageEvents;
      if (role !== 'superadmin' && (role !== 'admin' || !hasPermission)) {
        router.push('/');
      }
    }
  }, [status, session, router]);

  const hasAccess = session && (
    session.user.role === 'superadmin' || 
    (session.user.role === 'admin' && session.user.permissions?.manageEvents)
  );

  if (status === 'loading' || !hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen flex bg-neutral-950 text-neutral-100">
      
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900/50 backdrop-blur-md border-r border-neutral-900 hidden md:flex flex-col p-6 gap-6 shrink-0">
        
        {/* User Card */}
        <div className="flex items-center gap-3 p-3 bg-neutral-950/40 border border-neutral-850 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-accent-500 flex items-center justify-center font-bold text-white text-sm">
            {session.user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={session.user.image} alt={session.user.name || ''} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>{session.user.name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-neutral-50 truncate leading-snug">{session.user.name}</p>
            <span className="inline-block text-[9px] font-bold uppercase rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/20 px-2 py-0.5 tracking-wider mt-1">
              {session.user.role === 'superadmin' ? 'Superadmin' : 'Admin'}
            </span>
          </div>
        </div>

        {/* Links Navigation */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
                  isActive 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10' 
                    : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 lg:p-10 max-w-7xl mx-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
