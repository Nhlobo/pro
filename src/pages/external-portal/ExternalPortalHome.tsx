import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { PORTAL_TYPE_LABEL } from '@/types/externalPortal';

/**
 * Landing router right after sign-in. Referring Attorneys go straight
 * into their real portal (Phase 3). Medical Experts still see the
 * placeholder until Phase 4 builds their portal.
 */
const ExternalPortalHome: React.FC = () => {
  const { session, clearSession } = useExternalPortalSession();

  if (!session) return null;

  if (session.portal_type === 'attorney') {
    return <Navigate to="/external-portal/attorney/cases" replace />;
  }

  return (
    <div className="brand-legal-theme flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Helmet><title>External Portal</title></Helmet>

      <Card className="w-full max-w-md rounded-none border-black/10 shadow-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-2 h-8 w-8 text-[#00BAAD]" />
          <CardTitle>You're signed in</CardTitle>
          <CardDescription>{PORTAL_TYPE_LABEL[session.portal_type]} Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Welcome, <span className="font-medium text-black">{session.full_name}</span>.
          </p>
          <p className="text-xs text-slate-500">
            The Medical Expert Portal isn't wired up yet — that's the next phase of the External Portal Module.
          </p>
          <Button variant="outline" className="w-full rounded-none border-black/15" onClick={clearSession}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalPortalHome;
