import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useEditPermissions } from '@/hooks/useEditPermissions';

interface EditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  recordId: string;
  originalData: any;
  requestedChanges: any;
  onSuccess?: () => void;
}

export const EditRequestDialog = ({
  open,
  onOpenChange,
  tableName,
  recordId,
  originalData,
  requestedChanges,
  onSuccess
}: EditRequestDialogProps) => {
  const [reason, setReason] = useState('');
  const { requestEditPermission, loading } = useEditPermissions();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return;
    }

    const success = await requestEditPermission(
      tableName,
      recordId,
      reason,
      requestedChanges,
      originalData
    );

    if (success) {
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Edit Permission</DialogTitle>
          <DialogDescription>
            This data is older than 30 days and requires administrator approval to edit.
            Please provide a reason for this edit request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Reason for Edit</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need to edit this data..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p><strong>Table:</strong> {tableName}</p>
            <p><strong>Record ID:</strong> {recordId}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};