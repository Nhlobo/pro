import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { PORTAL_TYPE_LABEL } from '@/types/externalPortal';

/**
 * Temporary landing page. Confirms sign-in worked end-to-end for both
 * portal types. Phase 3 replaces this for `portal_type === 'attorney'`
 * with the real Referring Attorney Portal; Phase 4 does the same for
 * `'expert'`.
 */
const ExternalPortalHome: React.FC = () => {
  const { session, clearSession } = useExternalPortalSession();

  if (!session) return null;

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
            Case views for the {PORTAL_TYPE_LABEL[session.portal_type]} Portal aren't wired up yet —
            that's Phase {session.portal_type === 'attorney' ? '3' : '4'} of the External Portal Module.
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
