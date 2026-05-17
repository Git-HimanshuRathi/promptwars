import LexGuardAnalysis from '@/components/lexguard-analysis';
import { MarketingShell } from '@/components/marketing-shell';

export const metadata = {
  title: 'Live analysis — LEXGUARD',
  description: 'Adversarial multi-agent review of MSA-2026-03-v3.',
};

export default function AnalyzePage() {
  return (
    <MarketingShell>
      <LexGuardAnalysis />
    </MarketingShell>
  );
}
