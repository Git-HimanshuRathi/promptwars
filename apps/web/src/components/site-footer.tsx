import { GradientLogo } from '@/components/design/gradient-logo';

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-white/[0.06] mt-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-white/60">
          <GradientLogo size="sm" />
          <span className="font-semibold tracking-[0.18em] text-white/80">LEXGUARD</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">
            Built for the Prompt Wars hackathon · {new Date().getFullYear()}
          </span>
        </div>
        <p className="text-xs text-white/60 max-w-md md:text-right">
          Not legal advice. Always consult a qualified attorney for binding agreements.
        </p>
      </div>
    </footer>
  );
}
