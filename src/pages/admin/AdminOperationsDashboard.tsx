import React from 'react';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

/**
 * Operations Dashboard body.
 *
 * Deliberately mirrors the Auth.tsx brand panel (same gradient-nav wash,
 * logo mark, headline, and footer) rather than any stat/case content —
 * this is the exact "We touch a file. We change lives." screen, filling
 * the whole content area below the portal's shared teal header.
 */
const AdminOperationsDashboard: React.FC = () => {
  return (
    <div className="relative -m-3 flex min-h-[calc(100vh-8.5rem)] flex-col justify-between overflow-hidden gradient-nav p-6 text-white sm:-m-4 sm:min-h-[calc(100vh-9rem)] sm:p-10 lg:-m-6">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="rounded-full bg-white/15 p-2 ring-2 ring-white/30 backdrop-blur">
          <img src={logoSrc} alt="Kutlwano & Associate" className="h-12 w-12 object-contain" />
        </div>
        <div>
          <div className="text-lg font-bold tracking-wide">Medico-Legal Pro</div>
          <div className="text-xs text-white/80">Kutlwano &amp; Associate</div>
        </div>
      </div>

      <div className="relative space-y-4">
        <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
          We touch a file.<br />We change lives.
        </h1>
        <p className="max-w-md text-sm text-white/85 xl:text-base">
          Sign in with your authorised staff account to access your assigned workspace and manage medico-legal cases.
        </p>
      </div>

      <div className="relative text-xs text-white/70">
        © {new Date().getFullYear()} Kutlwano &amp; Associate (Pty) Ltd
      </div>
    </div>
  );
};

export default AdminOperationsDashboard;
