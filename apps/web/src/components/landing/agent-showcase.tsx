'use client';

import { motion } from 'framer-motion';
import {
  Swords,
  Shield,
  Gavel,
  Lock,
  DollarSign,
  Scale,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { Glass } from '@/components/design/glass';
import { SectionHeader } from '@/components/design/section';

const AGENTS: {
  name: string;
  role: string;
  desc: string;
  Icon: LucideIcon;
  grad: string;
  ring: string;
}[] = [
  {
    name: 'Risk Detection',
    role: 'Adversary',
    desc: 'Hunts one-sided, exploitative clauses',
    Icon: Swords,
    grad: 'from-fuchsia-500 to-rose-500',
    ring: 'ring-fuchsia-400/20',
  },
  {
    name: 'Ambiguity',
    role: 'Linguist',
    desc: 'Flags vague, sole-discretion language',
    Icon: Eye,
    grad: 'from-amber-400 to-orange-500',
    ring: 'ring-amber-400/20',
  },
  {
    name: 'Privacy',
    role: 'Forensics',
    desc: 'GDPR · CCPA · DPDP compliance',
    Icon: Lock,
    grad: 'from-emerald-400 to-teal-500',
    ring: 'ring-emerald-400/20',
  },
  {
    name: 'Financial',
    role: 'Auditor',
    desc: 'Hidden costs · auto-renewal · damages',
    Icon: DollarSign,
    grad: 'from-yellow-400 to-amber-500',
    ring: 'ring-yellow-400/20',
  },
  {
    name: 'Simplification',
    role: 'Translator',
    desc: 'Plain-English rewrite of legalese',
    Icon: Scale,
    grad: 'from-blue-400 to-cyan-500',
    ring: 'ring-blue-400/20',
  },
  {
    name: 'User Advocate',
    role: 'Predator',
    desc: "Argues from the user's perspective",
    Icon: Swords,
    grad: 'from-rose-500 to-pink-500',
    ring: 'ring-rose-400/20',
  },
  {
    name: 'Counterargument',
    role: 'Counsel',
    desc: 'Steel-mans the drafter, reduces noise',
    Icon: Shield,
    grad: 'from-sky-400 to-blue-500',
    ring: 'ring-sky-400/20',
  },
];

export function AgentShowcase(): React.JSX.Element {
  return (
    <section
      aria-labelledby="agents-heading"
      className="border-y border-white/[0.06] bg-white/[0.01]"
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-24">
        <SectionHeader
          eyebrow="Agent architecture"
          title={
            <>
              Seven specialist roles.{' '}
              <span className="gradient-text">One verdict.</span>
            </>
          }
          description="A unified Gemini call runs every specialist role at once. The User Advocate and Counterargument then debate each finding — confidence-weighted disagreement re-scores the risk."
        />

        <ul
          aria-label="Specialist AI agents"
          className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl mx-auto"
        >
          {AGENTS.map((a, i) => {
            const Icon = a.Icon;
            return (
              <motion.li
                key={a.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Glass className="p-4 h-full hover:border-white/15 transition-colors">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${a.grad} ${a.ring}`}
                      aria-hidden
                    >
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{a.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5">
                        {a.role}
                      </p>
                      <p className="text-xs text-white/60 mt-2 leading-relaxed">{a.desc}</p>
                    </div>
                  </div>
                </Glass>
              </motion.li>
            );
          })}
          <li>
            <Glass className="p-4 h-full glass-border">
              <div className="flex items-start gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 ring-1 ring-violet-400/20"
                  aria-hidden
                >
                  <Gavel className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Arbiter</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5">
                    Judge
                  </p>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">
                    Aggregates findings, applies confidence-weighted score adjustments, issues
                    final ruling.
                  </p>
                </div>
              </div>
            </Glass>
          </li>
        </ul>
      </div>
    </section>
  );
}
