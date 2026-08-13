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
 * the attorney-specific Help page (contact details + "firm not linked"
 * explainer), not the internal /help.
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
        <Link to="/attorney-portal/legal/help">
          <LifeBuoy className="mr-1.5 h-4 w-4" /> Get Help
        </Link>
      </Button>
    }
  />
);

export default AttorneyNotLinkedState;
