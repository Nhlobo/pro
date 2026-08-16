import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalEmptyState } from '@/components/attorney-portal/ui/PortalPrimitives';

/**
 * "Attorney firm not linked" error state — same pattern as
 * ExpertNotLinkedState. Pages that need a linked referring_attorney_id
 * check `profile.referring_attorney_id` BEFORE ever rendering their real
 * content (see AttorneyAppointments), so this is the only thing painted
 * on first render when the account isn't linked yet — never a flash of
 * the real page followed by a bounce back here. The Help button goes to
 * AttorneyHelpPortal (/attorney-portal/help), the signed-in variant of
 * the attorney Help page — NOT /attorney-portal/legal/help, which is the
 * signed-OUT variant reachable from the sign-in page and whose "back"
 * link goes to sign in. This component only ever renders for a signed-in
 * attorney, so its Help link must land somewhere whose "back" returns to
 * the dashboard, not to sign-in.
 */
export const AttorneyNotLinkedState: React.FC<{ description?: string }> = ({
  description = "Your account isn't linked to a firm's referrals yet. Contact an administrator or get help below.",
}) => (
  <PortalEmptyState
    icon={AlertTriangle}
    title="Firm Not Linked"
    description={description}
    action={
      <Button asChild variant="outline" size="sm" className="mt-2 rounded-none">
        <Link to="/attorney-portal/help">
          <LifeBuoy className="mr-1.5 h-4 w-4" /> Get Help
        </Link>
      </Button>
    }
  />
);

export default AttorneyNotLinkedState;
