'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /* Dashboard has its own sidebar shell — hide the global chrome */
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  return (
    <ThemeProvider>
      <AuthProvider>
        {!isDashboard && <Navbar />}
        <main className={isDashboard ? '' : 'flex-1'}>{children}</main>
        {!isDashboard && <Footer />}
      </AuthProvider>
    </ThemeProvider>
  );
}
