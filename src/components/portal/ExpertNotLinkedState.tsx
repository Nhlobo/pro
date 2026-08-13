import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalEmptyState } from '@/components/attorney-portal/ui/PortalPrimitives';

/**
 * "Expert profile not linked" error state — the same PortalEmptyState
 * visual language ExpertDashboard already used for this case, now
 * shared so every Expert Portal page shows it consistently instead of
 * silently rendering nothing (Cases/Schedule/Performance/Reports) or a
 * plain unstyled sentence (Profile). Each page passes its own
 * `description` so the copy still reads as written for that page.
 * The Help button goes to the expert-specific Help page (contact
 * details + "profile not linked" explainer), not the internal /help.
 */
export const ExpertNotLinkedState: React.FC<{ description?: string }> = ({
  description = 'Your account is not linked to a medical expert profile. Contact an administrator or get help below.',
}) => (
  <PortalEmptyState
    icon={AlertTriangle}
    title="Expert Profile Not Linked"
    description={description}
    action={
      <Button asChild variant="outline" size="sm" className="mt-2 rounded-none">
        <Link to="/expert-portal/legal/help">
          <LifeBuoy className="mr-1.5 h-4 w-4" /> Get Help
        </Link>
      </Button>
    }
  />
);

export default ExpertNotLinkedState;
