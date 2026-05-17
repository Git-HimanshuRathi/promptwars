'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Sparkles,
  CircleDot,
  Lock,
  Eye,
  Swords,
  Shield,
  Gavel,
} from 'lucide-react';
import { GradientLogo } from '@/components/design/gradient-logo';
import { Glass } from '@/components/design/glass';
import { Button } from '@/components/ui/button';

export function Hero(): React.JSX.Element {
  return (
    <section aria-labelledby="hero-heading" className="relative">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 pt-16 md:pt-24 pb-20 md:pb-32">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          {/* Copy */}
          <div className="lg:col-span-7 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-violet-200"
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              Adversarial multi-agent · Powered by Gemini
            </motion.div>

            <motion.h1
              id="hero-heading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-5xl md:text-[68px] font-semibold leading-[1.05] tracking-tight text-white"
            >
              Catch the clause
              <br />
              that <span className="gradient-text">catches you.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed"
            >
              LEXGUARD is an adversarial multi-agent AI that reads contracts,
              offer letters, ToS, and privacy policies — and surfaces every
              exploitative, one-sided, and user-hostile clause you&rsquo;d
              otherwise sign by accident.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="flex flex-col sm:flex-row gap-3"
            >
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
                <Link href="/upload">Upload a document</Link>
              </Button>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 pt-8"
            >
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                    {s.label}
                  </dt>
                  <dd className="text-2xl md:text-3xl font-semibold text-white tracking-tight mt-1">
                    {s.value}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Demo card preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <Glass className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <GradientLogo size="sm" />
                  <span className="font-semibold tracking-[0.18em]">LEXGUARD</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <CircleDot className="h-3 w-3 text-emerald-400" aria-hidden />
                  Live
                </div>
              </div>

              <div className="px-5 py-5 space-y-5 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 mb-2">
                    Exploitation Index
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-semibold gradient-text">7.3</span>
                    <span className="text-xs uppercase tracking-[0.22em] text-white/60">
                      / 10 · high risk
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {SAMPLE_FINDINGS.map((f) => (
                    <div
                      key={f.section}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${f.dot}`} aria-hidden />
                      <span className="font-mono text-[11px] text-white/60 shrink-0">
                        {f.section}
                      </span>
                      <span className="truncate text-[13px] text-white/85">{f.title}</span>
                      <span
                        className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${f.chip}`}
                      >
                        {f.severity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { Icon: Swords, color: 'from-fuchsia-500 to-rose-500', label: 'Predator' },
                    { Icon: Shield, color: 'from-sky-400 to-blue-500', label: 'Counsel' },
                    { Icon: Gavel, color: 'from-violet-500 to-indigo-500', label: 'Arbiter' },
                  ].map(({ Icon, color, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                    >
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${color}`}
                        aria-hidden
                      >
                        <Icon className="h-3 w-3 text-white" />
                      </span>
                      <span className="text-[11px] text-white/70 truncate">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] px-5 py-3 flex items-center justify-between text-[11px] text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3" aria-hidden />
                  End-to-end encrypted
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-3 w-3" aria-hidden />
                  Heatmap on
                </span>
              </div>
            </Glass>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { label: 'Risk categories', value: '15' },
  { label: 'Avg. analysis', value: '~45s' },
  { label: 'Languages', value: '40+' },
  { label: 'Free-tier capacity', value: '750/d' },
] as const;

const SAMPLE_FINDINGS = [
  {
    section: 'Section 11.4',
    title: 'Asymmetric liability cap',
    severity: 'Critical',
    dot: 'bg-rose-400',
    chip: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
  },
  {
    section: 'Section 14.1',
    title: 'Auto-renewal · 60-day window',
    severity: 'High',
    dot: 'bg-fuchsia-400',
    chip: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20',
  },
  {
    section: 'Section 18.3',
    title: 'Overbroad IP assignment',
    severity: 'Medium',
    dot: 'bg-amber-300',
    chip: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
  },
] as const;
