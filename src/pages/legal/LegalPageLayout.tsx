import { ReactNode, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

const LegalPageLayout = ({ title, description, children }: LegalPageLayoutProps) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
  <div className="min-h-screen w-full bg-[#F7F5EE]">
    <Helmet>
      <title>{title} — Medico-Legal Pro</title>
      <meta name="description" content={description} />
    </Helmet>

    <header className="gradient-nav text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-6 sm:px-6">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/80">
            Medico-Legal Pro
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </header>

    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <article className="prose prose-slate max-w-none bg-white p-6 shadow-sm sm:p-10">
        {children}
      </article>

      <div className="mt-6 text-center">
        <Link
          to="/auth"
          className="text-sm font-semibold text-black hover:text-[#00BAAD] hover:underline"
        >
          ← Return to sign in
        </Link>
      </div>
    </main>
  </div>
  );
};

export default LegalPageLayout;
