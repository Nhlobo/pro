import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEditPermissions } from '@/hooks/useEditPermissions';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { Eye, Check, X, Clock } from 'lucide-react';

export const EditRequestManagement = () => {
  const { isAdmin, loading: permLoading } = usePermissions();
  const { editRequests, processEditRequest, loading, refetch } = useEditPermissions();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    refetch();
  }, []);

  if (permLoading) {
    return <div>Loading permissions...</div>;
  }

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Administrator privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProcessRequest = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;

    const success = await processEditRequest(
      selectedRequest.id,
      status,
      adminNotes
    );

    if (success) {
      setShowDialog(false);
      setSelectedRequest(null);
      setAdminNotes('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = editRequests.filter(req => req.status === 'pending');
  const processedRequests = editRequests.filter(req => req.status !== 'pending');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Request Management</h1>
        <p className="text-muted-foreground">
          Manage edit requests for data older than 30 days
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            Edit requests awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No pending edit requests
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{request.table_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Record ID: {request.record_id}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="text-sm">
                    <p><strong>Requested by:</strong> {request.requested_by}</p>
                    <p><strong>Date:</strong> {format(new Date(request.created_at), 'PPP')}</p>
                    {request.request_reason && (
                      <p><strong>Reason:</strong> {request.request_reason}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processed Requests</CardTitle>
          <CardDescription>
            Previously approved or rejected edit requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No processed requests
            </p>
          ) : (
            <div className="space-y-4">
              {processedRequests.slice(0, 10).map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{request.table_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Record ID: {request.record_id}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="text-sm">
                    <p><strong>Requested by:</strong> {request.requested_by}</p>
                    <p><strong>Processed:</strong> {request.approved_at ? format(new Date(request.approved_at), 'PPP') : 'N/A'}</p>
                    <p><strong>Approved by:</strong> {request.approved_by || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Edit Request</DialogTitle>
            <DialogDescription>
              Review the details and approve or reject this edit request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Table:</strong> {selectedRequest.table_name}
                </div>
                <div>
                  <strong>Record ID:</strong> {selectedRequest.record_id}
                </div>
                <div>
                  <strong>Requested by:</strong> {selectedRequest.requested_by}
                </div>
                <div>
                  <strong>Date:</strong> {format(new Date(selectedRequest.created_at), 'PPP')}
                </div>
              </div>

              {selectedRequest.request_reason && (
                <div>
                  <Label>Reason for Edit</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">
                    {selectedRequest.request_reason}
                  </p>
                </div>
              )}

              <div>
                <Label>Original Data</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">
                  {JSON.stringify(selectedRequest.original_data, null, 2)}
                </pre>
              </div>

              <div>
                <Label>Requested Changes</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-32">
                  {JSON.stringify(selectedRequest.requested_changes, null, 2)}
                </pre>
              </div>

              <div>
                <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add any notes about this decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleProcessRequest('rejected')}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={() => handleProcessRequest('approved')}
              disabled={loading}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};