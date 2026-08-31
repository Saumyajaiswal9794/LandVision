import type { Metadata } from 'next';
import '../styles/globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'LandVision - AI Digitization of Land Ownership Records',
  description: 'AI-powered platform for digitizing Khasra, Khata, and Khatoni land records.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-brand-600 tracking-tight">
                LandVision
              </Link>
              <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                <Link href="/upload" className="hover:text-brand-500 transition-colors">Upload</Link>
                <Link href="/review" className="hover:text-brand-500 transition-colors">Review Dashboard</Link>
                <Link href="/map" className="hover:text-brand-500 transition-colors">GIS Map</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-brand-500">
                Login
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} LandVision (Ministry of Land Records). All rights reserved.
        </footer>
      </body>
    </html>
  );
}
