'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  Scale,
  Swords,
  Gavel,
  FileText,
  Lock,
  MessageSquare,
  ArrowUpRight,
  Check,
  Eye,
  CircleDot,
} from 'lucide-react';
import type { AnalysisResult } from '@lexguard/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { adaptAnalysis } from '@/lib/adapt-analysis';

/* -------------------------------------------------------------------------- */
/*  Public types — exported so the adapter can reference them                 */
/* -------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type AgentRole = 'predator' | 'counsel' | 'arbiter';

export interface Finding {
  id: string;
  section: string;
  title: string;
  severity: Severity;
  excerpt: string;
  vector: string;
  status: 'open' | 'resolved';
}

export interface AgentTurn {
  id: string;
  role: AgentRole;
  text: string;
  cite?: string;
  verdict?: 'exploit' | 'fair' | 'amend';
}

export interface Vector {
  label: string;
  score: number;
  sev: Severity;
}

export interface LexGuardAnalysisProps {
  /** Real result from the API. If omitted, the seed demo is rendered. */
  result?: AnalysisResult;
  /** Raw extracted document text — rendered in the contract pane. */
  documentText?: string;
  /** Display name (e.g. uploaded filename). */
  documentName?: string;
}

/* -------------------------------------------------------------------------- */
/*  Seed data — used when no `result` prop is passed (the /analyze demo)      */
/* -------------------------------------------------------------------------- */

const SEED_FINDINGS: Finding[] = [
  {
    id: 'f1',
    section: '§ 11.4',
    title: 'Asymmetric liability cap',
    severity: 'critical',
    excerpt:
      "Vendor's aggregate liability shall not exceed fees paid in the twelve (12) months preceding the claim. Customer's indemnification obligations are uncapped.",
    vector: 'Liability',
    status: 'open',
  },
  {
    id: 'f2',
    section: '§ 14.1',
    title: 'Auto-renewal with 60-day window',
    severity: 'high',
    excerpt:
      'This Agreement shall automatically renew for successive twelve-month terms unless either party provides written notice not less than sixty (60) days prior.',
    vector: 'Term',
    status: 'open',
  },
  {
    id: 'f3',
    section: '§ 7.2',
    title: 'Unilateral price escalation',
    severity: 'high',
    excerpt:
      "Vendor may modify fees upon thirty (30) days' notice. Customer's sole remedy is termination at the end of the then-current term.",
    vector: 'Commercial',
    status: 'open',
  },
  {
    id: 'f4',
    section: '§ 18.3',
    title: 'Overbroad IP assignment',
    severity: 'medium',
    excerpt:
      'All feedback, suggestions, and derivative works — including pre-existing methodologies — shall be the sole property of Vendor.',
    vector: 'IP',
    status: 'open',
  },
  {
    id: 'f5',
    section: '§ 22.1',
    title: 'Forum selection (Vendor home state)',
    severity: 'low',
    excerpt:
      'Any dispute shall be brought exclusively in the state or federal courts located in Santa Clara County, California.',
    vector: 'Disputes',
    status: 'resolved',
  },
];

const SEED_DEBATE: AgentTurn[] = [
  {
    id: 't1',
    role: 'predator',
    text: '§ 11.4 caps their exposure at last-12-months fees while your indemnity runs uncapped. On a $480k ACV this is a ~40× asymmetry — exactly the wedge we exploit on enterprise paper.',
    cite: '§ 11.4',
    verdict: 'exploit',
  },
  {
    id: 't2',
    role: 'counsel',
    text: 'Standard for vendor-favorable MSAs in this segment. Mirrorable via side letter; precedent in 73% of comparable Northwind agreements logged this quarter.',
    cite: '§ 11.4',
    verdict: 'fair',
  },
  {
    id: 't3',
    role: 'predator',
    text: "Precedent ≠ defensible. Pair it with § 18.3's pre-existing-methodology grab and you've ceded IP plus carried unlimited indemnity. Two separate hooks, one signature.",
    cite: '§ 18.3',
    verdict: 'exploit',
  },
  {
    id: 't4',
    role: 'arbiter',
    text: 'Material asymmetry confirmed. Recommend a mutual cap at 2× annual fees for direct damages, carve-out for IP indemnity only. Block signature until § 11.4 + § 18.3 amended.',
    cite: '§ 11.4 + § 18.3',
    verdict: 'amend',
  },
];

const SEED_VECTORS: Vector[] = [
  { label: 'Liability', score: 92, sev: 'critical' },
  { label: 'IP rights', score: 71, sev: 'high' },
  { label: 'Termination', score: 64, sev: 'high' },
  { label: 'Payment', score: 58, sev: 'medium' },
  { label: 'Disputes', score: 24, sev: 'low' },
];

const SEED_DOC_NAME = 'Acme Robotics × Northwind Inc.';
const SEED_GAUGE_SCORE = 7.3;
const SEED_RISK_BAND = 'high_risk';

/* -------------------------------------------------------------------------- */
/*  Tokens                                                                    */
/* -------------------------------------------------------------------------- */

const SEV: Record<
  Severity,
  { label: string; dot: string; chip: string; ring: string; text: string }
> = {
  critical: {
    label: 'Critical',
    dot: 'bg-rose-400',
    chip: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
    ring: 'ring-rose-400/30',
    text: 'text-rose-300',
  },
  high: {
    label: 'High',
    dot: 'bg-fuchsia-400',
    chip: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20',
    ring: 'ring-fuchsia-400/30',
    text: 'text-fuchsia-300',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-300',
    chip: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    ring: 'ring-amber-300/20',
    text: 'text-amber-200',
  },
  low: {
    label: 'Low',
    dot: 'bg-sky-300',
    chip: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    ring: 'ring-sky-300/20',
    text: 'text-sky-200',
  },
};

const AGENT: Record<
  AgentRole,
  {
    name: string;
    role: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    grad: string;
    ring: string;
    tint: string;
    name_color: string;
  }
> = {
  predator: {
    name: 'Predator',
    role: 'Adversary',
    Icon: Swords,
    grad: 'from-fuchsia-500 to-rose-500',
    ring: 'ring-fuchsia-400/30',
    tint: 'bg-fuchsia-500/[0.07] border-fuchsia-400/10',
    name_color: 'text-fuchsia-200',
  },
  counsel: {
    name: 'Counsel',
    role: 'Defender',
    Icon: Shield,
    grad: 'from-sky-400 to-blue-500',
    ring: 'ring-sky-400/30',
    tint: 'bg-sky-500/[0.06] border-sky-400/10',
    name_color: 'text-sky-200',
  },
  arbiter: {
    name: 'Arbiter',
    role: 'Judge',
    Icon: Gavel,
    grad: 'from-violet-500 to-indigo-500',
    ring: 'ring-violet-400/30',
    tint: 'bg-violet-500/[0.07] border-violet-400/10',
    name_color: 'text-violet-200',
  },
};

/* -------------------------------------------------------------------------- */
/*  Small primitives                                                          */
/* -------------------------------------------------------------------------- */

function Glass({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={
        'relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl ' +
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_30px_60px_-20px_rgba(0,0,0,0.6)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

function SeverityChip({ s }: { s: Severity }) {
  const t = SEV[s];
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ' +
        t.chip
      }
    >
      <span className={'h-1.5 w-1.5 rounded-full ' + t.dot} aria-hidden />
      {t.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Document title strip                                                      */
/* -------------------------------------------------------------------------- */

function DocStrip({
  liveCount,
  docName,
  pages,
  isLive,
}: {
  liveCount: number;
  docName: string;
  pages: number;
  isLive: boolean;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
            <FileText className="h-3 w-3" aria-hidden />
            {isLive ? 'Analyzed document' : 'Master Services Agreement'}
          </div>
          <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            {docName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <CircleDot className="h-3 w-3 text-emerald-400" aria-hidden />
              {isLive ? 'Live analysis' : 'Synced · 2m ago'}
            </span>
            <span aria-hidden>·</span>
            <span>{pages} pages · indexed</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" aria-hidden />
              End-to-end encrypted
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
          aria-label={`${liveCount} agents currently analyzing`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-400" />
          </span>
          <span className="text-xs text-white/60">{liveCount} agents debating · live</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Contract pane                                                             */
/* -------------------------------------------------------------------------- */

function ContractPane({
  findings,
  active,
  onSelect,
  documentText,
}: {
  findings: Finding[];
  active: Finding;
  onSelect: (f: Finding) => void;
  documentText?: string;
}) {
  return (
    <Glass className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-white/80">Document</span>
          <span className="text-white/55">·</span>
          <span>{documentText ? 'Extracted text' : 'Article XI — Limitation of Liability'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
          <Eye className="h-3 w-3" aria-hidden />
          <span>Heatmap on</span>
        </div>
      </div>

      {documentText ? (
        <ExtractedTextView text={documentText} active={active} onSelect={onSelect} findings={findings} />
      ) : (
        <SeedContractView active={active} onSelect={onSelect} findings={findings} />
      )}

      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-white/60">
        <span>{documentText ? `${documentText.length.toLocaleString()} chars extracted` : 'Page 24 of 47'}</span>
        <div className="flex items-center gap-2">
          <span>Heatmap density</span>
          <div className="flex items-center gap-px">
            {[0.15, 0.3, 0.55, 0.9].map((o, i) => (
              <span
                key={i}
                className="h-1.5 w-3 rounded-sm bg-fuchsia-400"
                style={{ opacity: o }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </Glass>
  );
}

function ExtractedTextView({
  text,
  findings,
  active,
  onSelect,
}: {
  text: string;
  findings: Finding[];
  active: Finding;
  onSelect: (f: Finding) => void;
}) {
  const slice = text.slice(0, 6000);
  const needle = active.excerpt?.slice(0, 80).trim();
  const idx = needle ? slice.indexOf(needle) : -1;

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-[13.5px] leading-7 text-white/70">
      <FindingPills findings={findings} active={active} onSelect={onSelect} />

      {idx > -1 ? (
        <>
          <p>{slice.slice(0, idx)}</p>
          <div
            className="group relative block w-full rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/[0.08] via-rose-500/[0.04] to-transparent p-4 text-left ring-1 ring-fuchsia-400/20"
            aria-label={`Active finding: ${active.title}`}
          >
            <span
              className="absolute -left-px top-3 h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-gradient-to-b from-fuchsia-400 via-rose-400 to-transparent"
              aria-hidden
            />
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-white/60">
                {active.section} — {active.vector}
              </span>
              <SeverityChip s={active.severity} />
            </div>
            <p className="text-white/85">
              <mark className="bg-fuchsia-500/20 px-1 py-0.5 text-fuchsia-100 decoration-fuchsia-300/60 decoration-wavy underline-offset-2">
                {slice.slice(idx, idx + needle!.length)}
              </mark>
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-fuchsia-200/80">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              {active.title}
            </div>
          </div>
          <p className="text-white/60">{slice.slice(idx + needle!.length, idx + needle!.length + 600)}…</p>
        </>
      ) : (
        slice
          .split(/\n\n+/)
          .slice(0, 8)
          .filter((p) => p.trim().length > 0)
          .map((para, i) => (
            <p key={i}>
              <span className="mr-1 font-mono text-[11px] text-white/55">{i + 1}</span>
              {para}
            </p>
          ))
      )}
    </div>
  );
}

function FindingPills({
  findings,
  active,
  onSelect,
}: {
  findings: Finding[];
  active: Finding;
  onSelect: (f: Finding) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-white/60">
        Findings
      </span>
      {findings.map((f) => {
        const t = SEV[f.severity];
        const on = f.id === active.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f)}
            className={
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ' +
              (on
                ? t.chip + ' ring-1 ring-fuchsia-400/30'
                : 'border-white/10 text-white/65 hover:text-white')
            }
          >
            <span className={'h-1.5 w-1.5 rounded-full ' + t.dot} aria-hidden />
            {f.section}
          </button>
        );
      })}
    </div>
  );
}

function SeedContractView({
  findings,
  active,
  onSelect,
}: {
  findings: Finding[];
  active: Finding;
  onSelect: (f: Finding) => void;
}) {
  const target = findings[0] ?? active;
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-[13.5px] leading-7 text-white/70">
      <p>
        <span className="mr-1 font-mono text-[11px] text-white/55">11.1</span>
        Each party acknowledges that the limitations and exclusions of liability
        set forth in this Article XI are a fundamental basis of the bargain
        between the parties and shall apply to the maximum extent permitted under
        applicable law.
      </p>
      <p>
        <span className="mr-1 font-mono text-[11px] text-white/55">11.2</span>
        Neither party shall be liable for any indirect, incidental, special,
        consequential, or punitive damages arising out of or relating to this
        Agreement, regardless of the theory of liability.
      </p>

      <button
        type="button"
        onClick={() => onSelect(target)}
        className={
          'group relative block w-full rounded-xl border p-4 text-left transition ' +
          (active.id === target.id
            ? 'border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/[0.08] via-rose-500/[0.04] to-transparent ring-1 ring-fuchsia-400/20'
            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15')
        }
        aria-label={`Open finding: ${target.title}`}
      >
        <span
          className="absolute -left-px top-3 h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-gradient-to-b from-fuchsia-400 via-rose-400 to-transparent"
          aria-hidden
        />
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-white/60">
            {target.section} — {target.vector}
          </span>
          <SeverityChip s={target.severity} />
        </div>
        <p className="text-white/85">
          Notwithstanding anything to the contrary,{' '}
          <mark className="bg-fuchsia-500/20 px-1 py-0.5 text-fuchsia-100 decoration-fuchsia-300/60 decoration-wavy underline-offset-2">
            Vendor&rsquo;s aggregate liability shall not exceed the fees actually
            paid by Customer in the twelve (12) months immediately preceding the
            event
          </mark>{' '}
          giving rise to the claim. The foregoing limitation shall not apply to{' '}
          <mark className="bg-rose-500/25 px-1 py-0.5 text-rose-100 decoration-rose-300/60 decoration-wavy underline-offset-2">
            Customer&rsquo;s indemnification obligations under § 18, which shall be
            uncapped
          </mark>
          .
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-fuchsia-200/80">
          <ShieldAlert className="h-3 w-3" aria-hidden />
          Predator flagged · 40× asymmetry on $480k ACV
          <ArrowUpRight className="ml-auto h-3 w-3 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
      </button>

      <p>
        <span className="mr-1 font-mono text-[11px] text-white/55">11.5</span>
        The limitations set forth in § 11.4 shall not apply in cases of (a) gross
        negligence or willful misconduct, (b) breach of confidentiality obligations
        under § 9, or (c) violation of applicable data protection laws.
      </p>
      <p className="text-white/60">
        <span className="mr-1 font-mono text-[11px] text-white/65">11.6</span>
        Customer expressly waives any claim for lost profits, lost revenue, loss of
        goodwill, or loss of anticipated savings, whether in contract, tort, or
        otherwise…
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Debate pane                                                               */
/* -------------------------------------------------------------------------- */

function TypingDots() {
  const reduce = useReducedMotion();
  return (
    <span className="inline-flex items-center gap-1" aria-label="thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-white/60"
          animate={reduce ? {} : { opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

function AgentMessage({ turn, index }: { turn: AgentTurn; index: number }) {
  const a = AGENT[turn.role];
  const reduce = useReducedMotion();
  const Icon = a.Icon;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className="flex gap-3"
    >
      <div className="shrink-0 pt-0.5">
        <div
          className={
            'grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ' +
            a.grad +
            ' ring-1 ' +
            a.ring
          }
          aria-hidden
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={'text-xs font-medium ' + a.name_color}>{a.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-white/55">
            {a.role}
          </span>
          {turn.cite && (
            <span className="ml-auto font-mono text-[10px] text-white/60">
              {turn.cite}
            </span>
          )}
        </div>
        <div
          className={
            'rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed text-white/85 ' +
            a.tint
          }
        >
          {turn.text}
          {turn.verdict && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
              {turn.verdict === 'exploit' && (
                <span className="text-rose-300">⚠ Exploit vector</span>
              )}
              {turn.verdict === 'fair' && (
                <span className="text-sky-300">✓ Defensible</span>
              )}
              {turn.verdict === 'amend' && (
                <span className="text-violet-300">⚖ Amend before signature</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function DebatePane({ debate, thinking }: { debate: AgentTurn[]; thinking: boolean }) {
  return (
    <Glass className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-white/80">Adversarial debate</span>
          <span className="text-white/55">·</span>
          <span>{debate.length} turns</span>
        </div>
        <div className="flex -space-x-1.5">
          {(Object.keys(AGENT) as AgentRole[]).map((k) => {
            const a = AGENT[k];
            const Icon = a.Icon;
            return (
              <span
                key={k}
                className={
                  'grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br ring-2 ring-[#07070A] ' +
                  a.grad
                }
                title={a.name}
                aria-label={a.name}
              >
                <Icon className="h-2.5 w-2.5 text-white" aria-hidden />
              </span>
            );
          })}
        </div>
      </div>

      <ul
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Live agent debate"
      >
        {debate.map((t, i) => (
          <AgentMessage key={t.id} turn={t} index={i} />
        ))}
        {thinking && (
          <li className="flex items-center gap-3 pl-11 text-xs text-white/60">
            <TypingDots /> Arbiter is drafting final ruling…
          </li>
        )}
      </ul>

    </Glass>
  );
}

/* -------------------------------------------------------------------------- */
/*  Risk pane                                                                 */
/* -------------------------------------------------------------------------- */

function ExploitGauge({ score }: { score: number }) {
  const reduce = useReducedMotion();
  const r = 54;
  const c = 2 * Math.PI * r;
  const target = (score / 10) * c;

  return (
    <div
      className="relative grid place-items-center"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={`Exploitation index ${score.toFixed(1)} out of 10`}
    >
      <svg viewBox="0 0 140 140" className="h-[148px] w-[148px] -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>
        <circle
          cx="70"
          cy="70"
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          fill="none"
        />
        <motion.circle
          cx="70"
          cy="70"
          r={r}
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - target }}
          transition={reduce ? { duration: 0 } : { duration: 1.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="bg-gradient-to-br from-white via-fuchsia-100 to-violet-200 bg-clip-text text-[34px] font-semibold leading-none text-transparent">
            {score.toFixed(1)}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-white/60">
            / 10
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploitationIndexBanner({
  findings,
  active,
  onSelect,
  vectors,
  gaugeScore,
  riskBand,
}: {
  findings: Finding[];
  active: Finding;
  onSelect: (f: Finding) => void;
  vectors: Vector[];
  gaugeScore: number;
  riskBand: string;
}) {
  const reduce = useReducedMotion();
  const bandLabel = riskBand.replace('_', ' ');
  const bandColor =
    riskBand === 'dangerous' || riskBand === 'high_risk'
      ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
      : riskBand === 'caution'
        ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
        : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';

  const openCount = findings.filter((f) => f.status === 'open').length;
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  return (
    <Glass className="overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-white/80">Exploitation Index</span>
          <span className="text-white/55">·</span>
          <span>Weighted across {vectors.length} attack vectors</span>
        </div>
        <Badge className={bandColor + ' capitalize'}>{bandLabel}</Badge>
      </div>

      {/* Body — gauge, vectors, finding counts */}
      <div className="grid gap-6 px-5 py-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <ExploitGauge score={gaugeScore} />

        <div className="space-y-2.5">
          {vectors.map((v, i) => {
            const t = SEV[v.sev];
            return (
              <div key={v.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-white/60">{v.label}</span>
                  <span className={'font-mono ' + t.text}>{v.score}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: v.score + '%' }}
                    transition={{
                      duration: 0.9,
                      delay: 0.1 + i * 0.06,
                      ease: 'easeOut',
                    }}
                    className={
                      'h-full rounded-full ' +
                      (v.sev === 'critical'
                        ? 'bg-gradient-to-r from-rose-400 to-fuchsia-400'
                        : v.sev === 'high'
                          ? 'bg-gradient-to-r from-fuchsia-400 to-violet-400'
                          : v.sev === 'medium'
                            ? 'bg-amber-300'
                            : 'bg-sky-300')
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column — findings stats */}
        <div className="hidden md:flex w-[200px] flex-col gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Findings</p>
            <p className="mt-1 text-3xl font-semibold text-white tabular-nums">{openCount}</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-[10px] text-white/60">
              <span className="text-rose-300">{criticalCount} crit</span>·
              <span className="text-fuchsia-300">{highCount} high</span>
            </p>
          </div>
        </div>
      </div>

      {/* Findings strip — horizontal scroll, clickable */}
      <div className="border-t border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            <span className="font-medium text-white/80">Findings</span>
            <Badge className="border-white/10 bg-white/[0.05] text-[10px] text-white/60">
              {openCount} open
            </Badge>
          </div>
          <button type="button" className="text-[11px] text-white/60 hover:text-white">
            Sort: severity
          </button>
        </div>
        <ul
          className="flex gap-2 overflow-x-auto px-5 pb-4 pt-1 snap-x snap-mandatory"
          aria-label="Risk findings — select to highlight in document"
        >
          {findings.map((f) => {
            const t = SEV[f.severity];
            const isActive = f.id === active.id;
            return (
              <li key={f.id} className="snap-start shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(f)}
                  aria-current={isActive ? 'true' : undefined}
                  className={
                    'group flex w-[260px] flex-col gap-1.5 rounded-xl border p-3 text-left transition ' +
                    (isActive
                      ? 'border-fuchsia-400/30 bg-fuchsia-500/[0.06] ring-1 ring-fuchsia-400/20'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]')
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={'h-1.5 w-1.5 shrink-0 rounded-full ' + t.dot}
                      aria-hidden
                    />
                    <span className="font-mono text-[10px] text-white/60">{f.section}</span>
                    <span className="ml-auto">
                      {f.status === 'resolved' ? (
                        <Check
                          className="h-3.5 w-3.5 text-emerald-400"
                          aria-label="resolved"
                        />
                      ) : (
                        <SeverityChip s={f.severity} />
                      )}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-white truncate">{f.title}</p>
                  <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                    {f.excerpt}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

    </Glass>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile tab switcher                                                       */
/* -------------------------------------------------------------------------- */

type PaneKey = 'doc' | 'debate';

function MobileTabs({
  value,
  onChange,
}: {
  value: PaneKey;
  onChange: (v: PaneKey) => void;
}) {
  const tabs: { id: PaneKey; label: string }[] = [
    { id: 'doc', label: 'Document' },
    { id: 'debate', label: 'Debate' },
  ];
  return (
    <div
      role="tablist"
      aria-label="View"
      className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={
              'rounded-lg py-1.5 text-[12px] font-medium transition ' +
              (on ? 'bg-white/[0.08] text-white' : 'text-white/65 hover:text-white/80')
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                      */
/* -------------------------------------------------------------------------- */

export default function LexGuardAnalysis({
  result,
  documentText,
  documentName,
}: LexGuardAnalysisProps = {}) {
  const adapted = useMemo(() => (result ? adaptAnalysis(result) : null), [result]);
  const findings = adapted?.findings ?? SEED_FINDINGS;
  const debate = adapted?.debate ?? SEED_DEBATE;
  const vectors = adapted?.vectors ?? SEED_VECTORS;
  const gaugeScore = adapted?.gaugeScore ?? SEED_GAUGE_SCORE;
  const riskBand = adapted?.riskBand ?? SEED_RISK_BAND;
  const docName = documentName ?? SEED_DOC_NAME;
  const pages = documentText ? Math.max(1, Math.ceil(documentText.length / 2000)) : 47;
  const isLive = Boolean(result);

  const [active, setActive] = useState<Finding>(findings[0] ?? SEED_FINDINGS[0]!);
  const [thinking, setThinking] = useState(!isLive);
  const [pane, setPane] = useState<PaneKey>('debate');

  useEffect(() => {
    setActive(findings[0] ?? SEED_FINDINGS[0]!);
  }, [findings]);

  useEffect(() => {
    if (isLive) {
      setThinking(false);
      return;
    }
    const t = setTimeout(() => setThinking(false), 3200);
    return () => clearTimeout(t);
  }, [isLive]);

  const liveCount = useMemo(() => (thinking ? 3 : 2), [thinking]);

  // No outer chrome — the page-level MarketingShell provides SiteHeader,
  // and the ambient background is rendered globally in the root layout.
  return (
    <div className="text-white">
      <DocStrip liveCount={liveCount} docName={docName} pages={pages} isLive={isLive} />

      <div className="mx-auto max-w-[1600px] space-y-4 px-4 pb-10 pt-6 sm:px-6 lg:space-y-5">
        {/* Row 1 — Exploitation Index (full width) */}
        <section aria-label="Exploitation index summary">
          <ExploitationIndexBanner
            findings={findings}
            active={active}
            onSelect={setActive}
            vectors={vectors}
            gaugeScore={gaugeScore}
            riskBand={riskBand}
          />
        </section>

        {/* Row 2 — Document + Debate side by side */}
        <div className="mb-2 lg:hidden">
          <MobileTabs value={pane} onChange={setPane} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section
            aria-label="Contract document"
            className={'lg:col-span-7 ' + (pane !== 'doc' ? 'hidden lg:block' : 'block')}
            style={{ height: 'min(calc(100vh - 520px), 760px)', minHeight: 560 }}
          >
            <ContractPane
              findings={findings}
              active={active}
              onSelect={setActive}
              documentText={documentText}
            />
          </section>

          <section
            aria-label="Multi-agent debate"
            className={'lg:col-span-5 ' + (pane !== 'debate' ? 'hidden lg:block' : 'block')}
            style={{ height: 'min(calc(100vh - 520px), 760px)', minHeight: 560 }}
          >
            <DebatePane debate={debate} thinking={thinking} />
          </section>
        </div>
      </div>
    </div>
  );
}
