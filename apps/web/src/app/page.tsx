import Link from 'next/link';
import {
  ArrowUpRight,
  ShieldAlert,
  Brain,
  Scale,
  Lock,
  Zap,
  FileSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/design/glass';
import { SectionHeader } from '@/components/design/section';
import { Hero } from '@/components/landing/hero';
import { AgentShowcase } from '@/components/landing/agent-showcase';
import { MarketingShell } from '@/components/marketing-shell';

const FEATURES = [
  {
    icon: ShieldAlert,
    title: 'Risk Detection',
    desc: 'Flags one-sided indemnity, unilateral modification rights, arbitration traps, dark patterns.',
  },
  {
    icon: Brain,
    title: 'Ambiguity Analysis',
    desc: 'Finds every "sole discretion", "reasonable efforts", and undefined term used against you.',
  },
  {
    icon: Scale,
    title: 'Financial Liability',
    desc: 'Quantifies hidden costs, auto-renewal traps, liquidated damages, personal guarantees.',
  },
  {
    icon: Lock,
    title: 'Privacy Forensics',
    desc: 'GDPR, CCPA, DPDP — surfaces clauses that surrender deletion rights or sell data.',
  },
  {
    icon: Zap,
    title: 'Streaming Analysis',
    desc: 'Live agent-by-agent progress via SSE. See findings appear in real time.',
  },
  {
    icon: FileSearch,
    title: 'Plain-English Output',
    desc: 'Every flagged clause is rewritten at a 9th-grade reading level with safer alternatives.',
  },
] as const;

const STEPS = [
  { title: 'Upload', body: 'PDF, DOCX, or paste raw text. Files never leave your tenant.' },
  {
    title: 'Multi-agent debate',
    body: 'A unified Gemini call runs the specialist analysis, then a Predator + Counsel debate re-scores every finding.',
  },
  {
    title: 'Decide',
    body: 'Risk score, severity-ranked findings, plain-English summary, redline-ready alternatives.',
  },
] as const;

export default function HomePage() {
  return (
    <MarketingShell>
      <Hero />

      <section
        id="features"
        aria-labelledby="features-heading"
        className="mx-auto max-w-[1600px] px-4 sm:px-6 py-24"
      >
        <SectionHeader
          eyebrow="Capabilities"
          title={
            <>
              Adversarial AI that{' '}
              <span className="gradient-text">argues both sides</span>
            </>
          }
          description="Specialist analysis plus an adversarial debate on every clause — so you see the risks opaque legalese was designed to hide."
        />

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Glass
                key={f.title}
                className="p-6 hover:border-white/15 transition-colors group"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-400/20 mb-4">
                  <Icon aria-hidden className="h-5 w-5 text-violet-300" />
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </Glass>
            );
          })}
        </div>
      </section>

      <AgentShowcase />

      <section
        id="how-it-works"
        aria-labelledby="how-heading"
        className="mx-auto max-w-[1600px] px-4 sm:px-6 py-24"
      >
        <SectionHeader
          eyebrow="Workflow"
          title="Three steps. Sixty seconds. Total clarity."
        />

        <ol className="mt-14 grid md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Glass className="p-6 h-full">
                <span className="text-7xl font-semibold leading-none gradient-text">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.body}</p>
              </Glass>
            </li>
          ))}
        </ol>

        <div className="text-center mt-14 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            size="lg"
            className="h-11 gap-2 bg-white px-5 text-sm font-medium text-black hover:bg-white/90"
          >
            <Link href="/analyze">
              View live demo
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-11 gap-2 border border-white/10 bg-white/[0.03] px-5 text-sm text-white/80 hover:bg-white/[0.06]"
          >
            <Link href="/upload">Upload your own</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
