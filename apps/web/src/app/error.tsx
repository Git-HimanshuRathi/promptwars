'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-[1600px] px-4 sm:px-6 py-32 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 mb-5">
        <AlertTriangle aria-hidden className="h-6 w-6 text-rose-300" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-white">
        Something went wrong
      </h1>
      <p className="text-white/60 mt-3 max-w-md mx-auto">
        {error.message || 'An unexpected error occurred while processing your request.'}
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-white/60 mt-2">Ref: {error.digest}</p>
      )}
      <Button
        onClick={reset}
        className="mt-8 h-11 gap-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-5 text-sm font-medium text-white hover:opacity-95"
      >
        Try again
      </Button>
    </div>
  );
}
