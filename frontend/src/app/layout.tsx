import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Job Market Intelligence',
  description:
    'Automated scraping, cleaning, embedding & visualization of AI/ML job listings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
