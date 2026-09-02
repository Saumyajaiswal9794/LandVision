import type { Metadata } from 'next';
import '../styles/globals.css';
import { NavBarWrapper } from './navBarWrapper';
import { ErrorBoundary } from '../components/ErrorBoundary';

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
        <NavBarWrapper />
        <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/*
            Global error boundary — catches any render-time crash in any
            route's component tree and shows a readable fallback instead of a
            blank white page. Each page also has its own ApiErrorFallback for
            failed network calls (handled separately from render errors).
          */}
          <ErrorBoundary label="LandVision">{children}</ErrorBoundary>
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400 mt-auto">
          &copy; {new Date().getFullYear()} LandVision (Ministry of Land Records). All rights reserved.
        </footer>
      </body>
    </html>
  );
}
