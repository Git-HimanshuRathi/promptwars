import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/**
 * Marketing-page shell — wraps `/`, `/upload`, `/dashboard` with the
 * sticky LEXGUARD header and footer. The `/analyze` view skips this
 * because it provides its own breadcrumb header.
 */
export function MarketingShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <SiteHeader />
      <main id="main" role="main" className="min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
