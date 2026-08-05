import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Scale, LogOut } from 'lucide-react';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';

const AttorneyPortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, clearSession } = useExternalPortalSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await clearSession();
    navigate('/external-portal/sign-in', { replace: true });
  };

  return (
    <div className="brand-legal-theme min-h-screen bg-slate-50">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#00BAAD]" />
            <div>
              <p className="text-sm font-semibold text-black">Referring Attorney Portal</p>
              {session && <p className="text-xs text-slate-500">{session.full_name}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-none border-black/15" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
};

export default AttorneyPortalLayout;
