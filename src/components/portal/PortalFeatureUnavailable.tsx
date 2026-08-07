import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PortalFeatureUnavailableProps {
  title: string;
  description?: string;
}

/**
 * Shown for old-portal pages that don't yet have a case-link-scoped,
 * OTP-safe data source behind them (e.g. Payments, Agreements,
 * Appointments, Notifications, Schedule, Performance, Profile).
 *
 * These pages were built against the internal app's Supabase-auth data
 * model (auth.uid()-scoped RLS, direct table access) and can't be
 * safely reused as-is now that this portal is authenticated via OTP
 * session instead — doing so would require new, carefully-scoped
 * server-side endpoints for each feature. Until those exist, this
 * placeholder is shown instead of rendering a page that would either
 * error out or attempt to query data the signed-in external session
 * has no right to see.
 */
const PortalFeatureUnavailable: React.FC<PortalFeatureUnavailableProps> = ({ title, description }) => (
  <div className="mx-auto max-w-xl py-10">
    <Card>
      <CardHeader className="items-center text-center">
        <Construction className="h-8 w-8 text-muted-foreground mb-2" />
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description || "This feature isn't connected yet for this portal. It's on our list to wire up next — check back soon."}
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  </div>
);

export default PortalFeatureUnavailable;
