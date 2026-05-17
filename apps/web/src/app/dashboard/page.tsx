import Link from 'next/link';
import {
  FileText,
  ShieldAlert,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Sparkles,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/design/glass';
import { MarketingShell } from '@/components/marketing-shell';

export const metadata = {
  title: 'Dashboard — LEXGUARD',
};

const KPIS: { label: string; value: string; delta: string; icon: LucideIcon }[] = [
  { label: 'Total analyses',  value: '128', delta: '+12% vs last month', icon: FileText },
  { label: 'Critical clauses', value: '47',  delta: 'across 23 documents', icon: ShieldAlert },
  { label: 'Avg. risk score',  value: '62',  delta: 'high-risk band',      icon: TrendingUp },
  { label: 'Avg. duration',    value: '46s', delta: 'p95: 71s',            icon: Clock },
];

type Row = { id: number; name: string; type: string; risk: number; when: string };
const DEMO_ROWS: Row[] = [
  { id: 1, name: 'SaaS subscription agreement.pdf', type: 'saas_agreement', risk: 84, when: '2 hours ago' },
  { id: 2, name: 'Cloud vendor MSA.docx',            type: 'contract',       risk: 71, when: 'Yesterday' },
  { id: 3, name: 'Privacy policy v3.pdf',            type: 'privacy_policy', risk: 58, when: '2 days ago' },
  { id: 4, name: 'Offer letter — Senior PM.pdf',     type: 'offer_letter',   risk: 32, when: '4 days ago' },
];

function riskChip(risk: number): { label: string; chip: string; dot: string } {
  if (risk >= 80) {
    return {
      label: 'Critical',
      chip: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
      dot: 'bg-rose-400',
    };
  }
  if (risk >= 60) {
    return {
      label: 'High',
      chip: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/20',
      dot: 'bg-fuchsia-400',
    };
  }
  if (risk >= 35) {
    return {
      label: 'Medium',
      chip: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
      dot: 'bg-amber-300',
    };
  }
  return {
    label: 'Low',
    chip: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    dot: 'bg-sky-300',
  };
}

export default function DashboardPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 pt-12 pb-16">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
              <CircleDot className="h-3 w-3 text-emerald-400" aria-hidden />
              Workspace overview
            </div>
            <h1 className="mt-1.5 text-4xl md:text-5xl font-semibold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-white/60 max-w-2xl">
              Recent analyses, risk trends, and team activity. Demo data shown until you
              connect a tenant.
            </p>
          </div>
          <Button
            asChild
            className="h-10 gap-2 bg-white px-4 text-sm font-medium text-black hover:bg-white/90 self-start"
          >
            <Link href="/upload">
              <Sparkles className="h-4 w-4" aria-hidden />
              New analysis
            </Link>
          </Button>
        </header>

        <section
          aria-labelledby="kpi-heading"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
        >
          <h2 id="kpi-heading" className="sr-only">
            Key metrics
          </h2>
          {KPIS.map((k) => {
            const Icon = k.icon;
            return (
              <Glass key={k.label} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                    {k.label}
                  </p>
                  <Icon className="h-4 w-4 text-violet-300" aria-hidden />
                </div>
                <p className="mt-3 text-3xl md:text-4xl font-semibold text-white tabular-nums tracking-tight">
                  {k.value}
                </p>
                <p className="mt-1 text-xs text-white/60">{k.delta}</p>
              </Glass>
            );
          })}
        </section>

        <Glass className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span className="font-medium text-white/80">Recent documents</span>
              <span className="text-white/55">·</span>
              <span>{DEMO_ROWS.length} shown</span>
            </div>
            <button type="button" className="text-[11px] text-white/60 hover:text-white">
              Sort: most recent
            </button>
          </div>

          <table className="w-full text-sm" aria-label="Recent analyzed documents">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-white/60 border-b border-white/[0.04]">
                <th scope="col" className="px-5 py-3 font-medium">Document</th>
                <th scope="col" className="px-5 py-3 font-medium">Type</th>
                <th scope="col" className="px-5 py-3 font-medium">Risk</th>
                <th scope="col" className="px-5 py-3 font-medium">Analyzed</th>
                <th scope="col" className="px-5 py-3 font-medium" aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {DEMO_ROWS.map((r) => {
                const chip = riskChip(r.risk);
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white">{r.name}</td>
                    <td className="px-5 py-3.5 text-white/60 capitalize">
                      {r.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${chip.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} aria-hidden />
                        {chip.label}
                        <span className="font-mono opacity-60 ml-1">{r.risk}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-white/60">{r.when}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href="/analyze"
                        className="inline-flex items-center gap-1 text-[12px] text-white/60 hover:text-white"
                      >
                        Open
                        <ArrowUpRight className="h-3 w-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Glass>
      </div>
    </MarketingShell>
  );
}
