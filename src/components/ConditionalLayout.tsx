'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Hide navbar and footer for dashboard routes
  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <>
      {!isDashboard && <Navbar />}
      <main style={{ flex: 1 }}>{children}</main>
      {!isDashboard && <Footer />}
    </>
  );
}
