import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { AmbientBackground } from '@/components/design/ambient-background';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'LEXGUARD — AI Rights & Contract Intelligence',
  description:
    'Adversarial multi-agent AI that detects exploitative clauses, hidden liabilities, and legal traps before you agree to them.',
  metadataBase: new URL('https://lexguard.ai'),
  openGraph: {
    title: 'LEXGUARD',
    description: 'Catch the clause that catches you.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#07070A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          mono.variable,
          'min-h-screen bg-[#07070A] font-sans text-white antialiased',
        )}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-violet-500 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <AmbientBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
