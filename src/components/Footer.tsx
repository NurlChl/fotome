import Link from 'next/link';
import { Camera } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 text-neutral-400 py-16">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-7.5 h-7.5 rounded-lg bg-primary-600 flex items-center justify-center shadow-md shadow-primary-600/10 transition-transform duration-150">
                <Camera className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-display font-bold text-base tracking-tight text-neutral-50 transition duration-150">
                FotoMe
              </span>
            </Link>
            <p className="text-sm max-w-xs leading-relaxed text-neutral-500">
              Temukan foto event Anda secara instan menggunakan teknologi AI face recognition. Cepat, aman, dan akurat.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-neutral-50 text-xs font-bold uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/events" className="hover:text-neutral-50 transition duration-150">Explore Events</Link></li>
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Pricing</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-neutral-50 text-xs font-bold uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Help Center</Link></li>
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-neutral-50 text-xs font-bold uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">About Us</Link></li>
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Contact</Link></li>
              <li><Link href="#" className="hover:text-neutral-50 transition duration-150">Blog</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-neutral-900">
          <p className="text-xs text-neutral-600">
            © {currentYear} FotoMe. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="p-2 hover:bg-neutral-900 hover:text-neutral-50 rounded-lg transition duration-150" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="#" className="p-2 hover:bg-neutral-900 hover:text-neutral-50 rounded-lg transition duration-150" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
