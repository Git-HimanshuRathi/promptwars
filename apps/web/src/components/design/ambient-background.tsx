/**
 * Three blurred gradient blooms + a subtle dot grid.
 * Renders behind every page — provides the LEXGUARD ambient atmosphere.
 */
export function AmbientBackground(): React.JSX.Element {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/15 blur-[120px]" />
      <div className="absolute -right-32 top-32 h-[460px] w-[460px] rounded-full bg-fuchsia-500/10 blur-[140px]" />
      <div className="absolute bottom-[-180px] left-1/3 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[140px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}
