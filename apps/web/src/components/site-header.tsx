import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { GradientLogo } from '@/components/design/gradient-logo';
import { Button } from '@/components/ui/button';

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07070A]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="LEXGUARD home"
          className="flex items-center gap-2 rounded-lg outline-none ring-offset-2 ring-offset-[#07070A] focus-visible:ring-2 focus-visible:ring-violet-400/60"
        >
          <GradientLogo size="sm" />
          <span className="text-[13px] font-semibold tracking-[0.18em] text-white">
            LEXGUARD
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-2 text-xs text-white/60 md:flex ml-2"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link href="/#how-it-works" className="hover:text-white transition-colors">
            How it works
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link href="/analyze" className="hover:text-white transition-colors">
            Live demo
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
        </nav>

        <div className="ml-auto">
          <Button
            asChild
            className="h-8 gap-1.5 bg-white px-3 text-xs font-medium text-black hover:bg-white/90"
          >
            <Link href="/upload">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Analyze
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
