import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import {
  useExternalPortalAccounts,
  useSetExternalPortalAccountStatus,
  usePermanentlyDeleteExternalPortalAccount,
} from '@/hooks/externalPortal/useExternalPortalAccounts';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminEmptyState, AdminLoadingState } from '@/components/admin/ui/AdminUI';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw } from 'lucide-react';
import { PORTAL_TYPE_LABEL } from '@/types/externalPortal';
import { formatDateTimeShort } from '@/utils/dateTime';

const ExternalPortalRecycleBin: React.FC = () => {
  const { data: accounts, isLoading } = useExternalPortalAccounts(true);
  const setStatus = useSetExternalPortalAccountStatus();
  const permanentlyDelete = usePermanentlyDeleteExternalPortalAccount();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Recycle Bin</title></Helmet>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="Recycle Bin"
          description="Deleted portal accounts. Restore them or permanently delete once you're sure."
          icon={Trash2}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading…" />
          ) : !accounts || accounts.length === 0 ? (
            <AdminEmptyState icon={Trash2} title="Recycle Bin is empty" description="Deleted portal accounts will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell>{PORTAL_TYPE_LABEL[a.portal_type]}</TableCell>
                      <TableCell className="text-slate-600">{a.email}</TableCell>
                      <TableCell className="text-slate-500">
                        {a.deleted_at ? formatDateTimeShort(a.deleted_at) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none border-black/15"
                            onClick={() => setStatus.mutate({ accountId: a.id, status: 'active' })}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                          <AlertDialog open={confirmId === a.id} onOpenChange={(o) => setConfirmId(o ? a.id : null)}>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="rounded-none">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Permanently
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently delete this account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes {a.full_name}'s portal account, sessions, OTP history and access links
                                  beyond recovery. Login history and audit logs are retained for compliance. This
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => {
                                    permanentlyDelete.mutate(a.id);
                                    setConfirmId(null);
                                  }}
                                >
                                  Delete Permanently
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalRecycleBin;
