import React from 'react';
import AttorneyPitchlog from '@/pages/AttorneyPitchlog';

interface AttorneyPitchlogModuleProps {
  defaultTab?: string;
}

/**
 * Wrapper that embeds the Attorney Pitchlog module inside the Admin
 * Attorney CRM. Passes `embedded` so AttorneyPitchlog drops its own
 * branded header, "Dashboard" back-link, and footer — the Admin CRM
 * already provides that page chrome one level up. Previously this relied
 * on a CSS selector to hide the standalone header, but the selector never
 * matched (the header is a <header> tag, not a <div>), so the full
 * standalone page — its own header, duplicate "Dashboard" link, and
 * footer — rendered a second time nested inside the CRM. That caused the
 * overlapping/duplicate headers, the stray floating date heading, the
 * "Dashboard" link kicking users out to the top-level dashboard instead
 * of just closing the tab, and the extra scroll space from the
 * duplicated footer.
 */
const AttorneyPitchlogModule: React.FC<AttorneyPitchlogModuleProps> = ({ defaultTab }) => {
  return (
    <div className="mt-2">
      <AttorneyPitchlog defaultTab={defaultTab} embedded />
    </div>
  );
};

export default AttorneyPitchlogModule;
