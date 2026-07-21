import React from 'react';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

// Computed once at module load, not on every render — the year doesn't
// change within a session, so there's no reason to touch `Date` per paint.
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Operations Dashboard body.
 *
 * Mirrors the Auth.tsx brand panel (same gradient-nav wash, logo mark,
 * headline, footer) as the full-bleed body beneath the portal's shared
 * teal header — this is the "We touch a file. We change lives." screen,
 * now written for staff already inside the workspace rather than signing
 * in to it.
 */
const AdminOperationsDashboard: React.FC = () => {
  return (
    <div className="relative -m-3 flex min-h-[calc(100vh-8.5rem)] flex-col justify-between overflow-hidden gradient-nav p-5 text-white sm:-m-4 sm:min-h-[calc(100vh-9rem)] sm:p-8 lg:-m-6 lg:p-10">
      {/* Ambient glow accents — decorative only, hidden from assistive tech
          and excluded from pointer events / paint cost. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl sm:-right-32 sm:-top-32 sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl sm:-bottom-24 sm:-left-24 sm:h-80 sm:w-80"
      />

      <div className="relative flex items-center gap-3">
        <div className="rounded-full bg-white/15 p-2 ring-2 ring-white/30 backdrop-blur">
          <img
            src={logoSrc}
            alt="Kutlwano & Associate"
            width={48}
            height={48}
            className="h-10 w-10 object-contain sm:h-12 sm:w-12"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div>
          <div className="text-base font-bold tracking-wide sm:text-lg">Medico-Legal Pro</div>
          <div className="text-xs text-white/80">Kutlwano &amp; Associate</div>
        </div>
      </div>

      <div className="relative max-w-2xl space-y-4">
        <h1 className="text-[clamp(1.75rem,6vw,3rem)] font-bold leading-tight">
          We touch a file.<br />We change lives.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-white/85 sm:max-w-lg sm:text-base xl:max-w-xl">
          Every case that lands in this workspace carries a person on the other side of it —
          waiting on a report, a referral, an answer. This is where that work gets done:
          your active cases, appointments and reports, kept accurate and moving, so the
          people counting on us are never left wondering where things stand.
        </p>
      </div>

      <div className="relative text-xs text-white/70">
        © {CURRENT_YEAR} Kutlwano &amp; Associate (Pty) Ltd
      </div>
    </div>
  );
};

export default AdminOperationsDashboard;
