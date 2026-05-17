import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientLogo } from '@/components/design/gradient-logo';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-32 text-center">
      <div className="flex justify-center mb-6">
        <GradientLogo size="lg" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.22em] text-violet-300 font-semibold">
        404
      </p>
      <h1 className="text-5xl md:text-6xl font-semibold mt-3 tracking-tight text-white">
        Page not found
      </h1>
      <p className="text-white/60 mt-5 max-w-md mx-auto">
        We couldn&rsquo;t find the page you were looking for. It may have been
        moved or no longer exists.
      </p>
      <Button
        asChild
        className="mt-8 h-11 gap-2 bg-white px-5 text-sm font-medium text-black hover:bg-white/90"
      >
        <Link href="/">
          Back to home
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
