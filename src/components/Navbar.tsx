'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Camera, ChevronDown, LogOut, Settings, Image as ImageIcon, ClipboardList, Menu, X, Sun, Moon, UserCheck } from 'lucide-react';

interface DbUser {
  faceDescriptor?: number[];
  [key: string]: unknown;
}

export default function Navbar() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dbUser, setDbUser] = useState<DbUser | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    // Run immediately on client-side mount to handle refreshed pages that are already scrolled
    handleScroll();

    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClickOutside);

    // Get current theme from document class
    const isLight = document.documentElement.classList.contains('light');
    setTimeout(() => {
      setTheme(isLight ? 'light' : 'dark');
    }, 0);

    // Fetch user details if logged in to check biometric status
    if (session) {
      fetch('/api/users/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setDbUser(data.user);
        })
        .catch((err) => console.error('Error fetching user profile in navbar:', err));
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [session]);

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



  return (
    <nav className={`fixed top-0 left-0 right-0 z-100 transition-all duration-150 ${
      isScrolled 
        ? 'bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 shadow-md' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-6 max-w-7xl h-20 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8.5 h-8.5 rounded-lg bg-primary-600 flex items-center justify-center shadow-md shadow-primary-600/10 group-hover:bg-primary-755 transition duration-150">
            <Camera className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-neutral-50 group-hover:text-neutral-50 transition duration-150">
            FotoMe
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm text-neutral-300 hover:text-neutral-100 transition duration-150">
            Home
          </Link>
          <Link href="/events" className="text-sm text-neutral-300 hover:text-neutral-100 transition duration-150">
            Explore Events
          </Link>
          <Link href="/how-it-works" className="text-sm text-neutral-300 hover:text-neutral-100 transition duration-150">
            Cara Kerja
          </Link>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-neutral-400 hover:text-neutral-50 rounded-lg hover:bg-neutral-850/60 transition duration-150"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {session ? (
            <div className="relative" ref={profileRef}>
              <button
                className="flex items-center gap-2 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full text-sm text-neutral-200 transition duration-150"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                id="navbar-profile-button"
              >
                <div className="w-6.5 h-6.5 rounded-full bg-primary-600 flex items-center justify-center font-bold text-white text-xs">
                  {session.user.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={session.user.image}
                      alt={session.user.name || ''}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{session.user.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="hidden sm:inline font-medium max-w-[120px] truncate">{session.user.name}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-150 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2.5 w-64 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl p-2 shadow-xl animate-fadeIn">
                  <div className="px-4 py-3 border-b border-neutral-800 mb-1.5">
                    <p className="font-semibold text-white text-sm truncate">{session.user.name}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{session.user.email}</p>
                    <span className="inline-block mt-2 text-[9px] px-2 py-0.5 font-bold uppercase rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20 tracking-wider">
                      {session.user.role}
                    </span>
                  </div>
                  
                  
                  {dbUser && !dbUser.faceDescriptor && (
                    <Link
                      href="/settings#face-registration"
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-primary-500 hover:bg-neutral-800 text-sm font-medium transition duration-150"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <UserCheck className="w-4 h-4" /> Register Face ID
                    </Link>
                  )}
                  {dbUser && dbUser.faceDescriptor && (
                    <div className="flex items-center gap-3 px-4 py-2 text-emerald-500 text-xs font-medium border-b border-neutral-800 pb-2">
                      <UserCheck className="w-4 h-4 text-emerald-500" /> Face ID Registered
                    </div>
                  )}

                  <Link
                    href="/my-photos"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800 text-sm transition duration-150"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <ImageIcon className="w-4 h-4 text-neutral-400" /> My Photos
                  </Link>
                  <Link
                    href="/orders"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800 text-sm transition duration-150"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <ClipboardList className="w-4 h-4 text-neutral-400" /> Order History
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-300 hover:text-neutral-50 hover:bg-neutral-800 text-sm transition duration-150"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <Settings className="w-4 h-4 text-neutral-400" /> Settings
                  </Link>
                  
                  <div className="border-t border-neutral-800 my-1.5" />
                  
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-rose-500 hover:bg-rose-950/20 text-sm text-left transition duration-150"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    id="navbar-logout-button"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login" className="btn btn-ghost btn-sm text-xs font-semibold">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm text-xs font-semibold rounded-lg px-4 py-2">
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900 rounded-lg transition"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            id="navbar-mobile-toggle"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-neutral-950/95 border-b border-neutral-900 px-6 py-4 space-y-3 flex flex-col backdrop-blur-md animate-fadeIn">
          <Link
            href="/"
            className="text-neutral-300 hover:text-neutral-50 py-2 text-sm font-medium border-b border-neutral-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/events"
            className="text-neutral-300 hover:text-neutral-50 py-2 text-sm font-medium border-b border-neutral-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Explore Events
          </Link>
          <Link
            href="/how-it-works"
            className="text-neutral-300 hover:text-neutral-50 py-2 text-sm font-medium border-b border-neutral-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Cara Kerja
          </Link>
          {!session ? (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="btn btn-secondary w-full py-2.5 text-center text-sm font-semibold rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn btn-primary w-full py-2.5 text-center text-sm font-semibold rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                signOut({ callbackUrl: '/' });
              }}
              className="btn btn-danger w-full py-2.5 text-sm font-semibold rounded-lg mt-2"
            >
              Sign Out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
