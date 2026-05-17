'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Loader2,
  AlertCircle,
  FileText,
  ArrowLeft,
  Sparkles,
  ArrowUpRight,
  CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AnalysisProgressEvent, AnalysisResult } from '@lexguard/shared';
import { DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from '@lexguard/shared';
import { uploadDocument, streamAnalysis } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/design/glass';
import LexGuardAnalysis from '@/components/lexguard-analysis';
import { formatBytes, cn } from '@/lib/utils';

type Mode = 'upload' | 'text';
type View = 'input' | 'result';

export function AnalyzeClient(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('upload');
  const [docType, setDocType] = useState<string>('other');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [agentEvents, setAgentEvents] = useState<AnalysisProgressEvent[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedText, setAnalyzedText] = useState<string>('');
  const [analyzedName, setAnalyzedName] = useState<string>('');
  const [view, setView] = useState<View>('input');
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setProgress(0);
    setAgentEvents([]);
    setResult(null);
    setError(null);
    setAnalyzedText('');
    setAnalyzedName('');
  };

  const handleFile = useCallback(
    async (file: File) => {
      reset();
      setBusy(true);
      try {
        toast.info(`Uploading ${file.name}…`);
        const res = await uploadDocument(file, { documentType: docType });
        setResult(res.result);
        setAnalyzedText(res.extractedText ?? '');
        setAnalyzedName(file.name);
        setView('result');
        toast.success(`Risk score: ${res.result.overallRiskScore}/100`);
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(false);
        setProgress(1);
      }
    },
    [docType],
  );

  const handleStreamText = useCallback(async () => {
    if (text.trim().length < 50) {
      toast.error('Please paste at least 50 characters of legal text.');
      return;
    }
    reset();
    setBusy(true);
    try {
      await streamAnalysis({ text, documentType: docType }, (e) => {
        setAgentEvents((prev) => [...prev, e]);
        if (typeof e.progress === 'number') setProgress(e.progress);
        if (e.type === 'completed' && e.partial) {
          const completed = e.partial as AnalysisResult;
          setResult(completed);
          setAnalyzedText(text);
          setAnalyzedName('Pasted text');
          setView('result');
          toast.success(`Risk score: ${completed.overallRiskScore}/100`);
        }
        if (e.type === 'error') {
          setError(e.error ?? 'Stream error');
          toast.error(e.error ?? 'Stream error');
        }
      });
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [text, docType]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    multiple: false,
    maxSize: MAX_UPLOAD_BYTES,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    onDrop: (accepted) => accepted[0] && void handleFile(accepted[0]),
    disabled: busy,
  });

  /* ── Result view — bare Claude design ──────────────────────────────── */
  if (view === 'result' && result) {
    return (
      <div>
        <Button
          variant="ghost"
          onClick={() => setView('input')}
          className="mb-4 h-8 gap-1.5 border border-white/10 bg-white/[0.03] px-2.5 text-xs text-white/70 hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Analyze another document
        </Button>
        <LexGuardAnalysis
          result={result}
          documentText={analyzedText}
          documentName={analyzedName}
        />
      </div>
    );
  }

  /* ── Input view ─────────────────────────────────────────────────────── */
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        {/* Mode + doc type as one row */}
        <Glass className="p-4 flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Input mode"
            className="inline-flex rounded-lg border border-white/[0.06] bg-white/[0.03] p-1"
          >
            {(['upload', 'text'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                  mode === m
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-white/65 hover:text-white/80',
                )}
              >
                {m === 'upload' ? 'Upload file' : 'Paste text'}
              </button>
            ))}
          </div>

          <label htmlFor="docType" className="sr-only">
            Document type
          </label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={busy}
            className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2.5 pr-8 text-xs text-white focus-visible:ring-2 focus-visible:ring-violet-400/60 capitalize"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0c0c12]">
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <span className="ml-auto text-[11px] text-white/60">
            Files up to {formatBytes(MAX_UPLOAD_BYTES)} · PDF · DOCX · TXT · MD
          </span>
        </Glass>

        {mode === 'upload' ? (
          <div
            {...getRootProps({
              role: 'button',
              'aria-label': 'Upload a document — drag and drop, or activate to choose a file',
              tabIndex: 0,
            })}
            className={cn(
              'relative grid place-items-center rounded-2xl border-2 border-dashed p-16 transition-all cursor-pointer',
              'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_30px_60px_-20px_rgba(0,0,0,0.6)]',
              isDragActive && 'border-violet-400/50 bg-violet-500/[0.06]',
              isDragReject && 'border-rose-400/50 bg-rose-500/[0.06]',
              !isDragActive && !isDragReject && 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              <div
                className={cn(
                  'mx-auto grid h-14 w-14 place-items-center rounded-xl mb-5',
                  isDragActive
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                    : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-300 ring-1 ring-violet-400/20',
                )}
              >
                {busy ? (
                  <Loader2 aria-hidden className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload aria-hidden className="h-6 w-6" />
                )}
              </div>
              <p className="text-lg font-medium text-white">
                {isDragActive ? 'Drop the file' : 'Drag & drop your document here'}
              </p>
              <p className="text-sm text-white/60 mt-1">
                Sent over TLS, analyzed in-memory, never persisted on disk
              </p>
              <span
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-4 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(232,121,249,0.55)]"
                aria-hidden
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy ? 'Analyzing…' : 'Choose a file'}
              </span>
            </div>
          </div>
        ) : (
          <Glass className="p-1">
            <label htmlFor="docText" className="sr-only">
              Paste document text
            </label>
            <textarea
              id="docText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              rows={16}
              placeholder="Paste your contract, ToS, privacy policy, or quotation here…"
              className="w-full rounded-2xl bg-transparent p-5 text-sm font-mono text-white placeholder:text-white/55 focus:outline-none resize-y"
            />
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
              <p className="text-[11px] text-white/60" aria-live="polite">
                {text.length.toLocaleString()} / 250,000 characters
              </p>
              <Button
                onClick={() => void handleStreamText()}
                disabled={busy || text.trim().length < 50}
                className="h-9 gap-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-4 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(232,121,249,0.55)] hover:opacity-95"
              >
                {busy ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden className="h-4 w-4" />
                )}
                {busy ? 'Analyzing…' : 'Run multi-agent analysis'}
              </Button>
            </div>
          </Glass>
        )}

        {error && (
          <Glass className="border-rose-400/30 bg-rose-500/[0.05] p-5 flex gap-3">
            <AlertCircle aria-hidden className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">Analysis failed</p>
              <p className="text-sm text-white/60 mt-1">{error}</p>
            </div>
          </Glass>
        )}
      </div>

      {/* Live progress sidebar */}
      <aside aria-label="Analysis progress" className="space-y-4">
        <Glass className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <CircleDot
                className={cn('h-3 w-3', busy ? 'text-fuchsia-400 animate-pulse' : 'text-emerald-400')}
                aria-hidden
              />
              <span className="font-medium text-white/80">
                {busy ? 'Running…' : result ? 'Complete' : 'Idle'}
              </span>
            </div>
            <span className="font-mono text-[11px] text-white/60 tabular-nums">
              {Math.round(progress * 100)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="px-5 pt-4">
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <ol
            className="px-5 py-4 space-y-2 max-h-[420px] overflow-y-auto"
            aria-live="polite"
          >
            {agentEvents.length === 0 ? (
              <li className="text-xs text-white/60">
                Agent activity will stream here in real time.
              </li>
            ) : (
              agentEvents.map((e, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <FileText
                    aria-hidden
                    className="h-3 w-3 text-violet-400 mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-[12px]">
                    {e.agent && (
                      <span className="mr-1.5 rounded-md bg-white/[0.05] border border-white/10 px-1.5 py-0.5 text-[10px] text-white/60 font-mono">
                        {e.agent}
                      </span>
                    )}
                    <span className="text-white/60">{e.message ?? e.type}</span>
                  </div>
                </li>
              ))
            )}
          </ol>
        </Glass>

        <Glass className="p-4 space-y-2 text-xs text-white/60">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
            What happens next
          </p>
          <p>
            Four clause-finding agents run in parallel on Gemini Pro. Then the
            User Advocate and Counterargument debate every finding before the
            Arbiter issues a final risk score.
          </p>
          <a
            href="/analyze"
            className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200 pt-1"
          >
            See a sample analysis
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        </Glass>
      </aside>
    </div>
  );
}
