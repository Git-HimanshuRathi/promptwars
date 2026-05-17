import { FileText, Sparkles, Shield } from 'lucide-react';
import { MarketingShell } from '@/components/marketing-shell';
import { AnalyzeClient } from '../analyze/analyze-client';

export const metadata = {
  title: 'Upload — LEXGUARD',
  description: 'Upload a document and let the adversarial agents go to work.',
};

export default function UploadPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 pt-12 pb-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
            <FileText className="h-3 w-3" aria-hidden />
            Analyze
          </div>
          <h1 className="mt-1.5 text-4xl md:text-5xl font-semibold tracking-tight text-white">
            Upload a document
          </h1>
          <p className="mt-3 text-white/60 max-w-2xl">
            Drop a contract, offer letter, ToS, privacy policy, or paste raw text.
            Our multi-agent debate will surface every risk in plain English.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              End-to-end encrypted upload
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" aria-hidden />
              Gemini 2.0 Flash
            </span>
            <span aria-hidden>·</span>
            <span>Average analysis: ~45s</span>
          </div>
        </header>

        <AnalyzeClient />
      </div>
    </MarketingShell>
  );
}
