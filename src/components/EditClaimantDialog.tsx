import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Claimant {
  id: string;
  first_name: string;
  last_name: string;
  contact_number?: string;
  auto_id: string;
  referring_attorney_id: string;
}

interface EditClaimantDialogProps {
  claimant: Claimant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const EditClaimantDialog: React.FC<EditClaimantDialogProps> = ({ claimant, open, onOpenChange, onSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  useEffect(() => {
    if (claimant) {
      setFirstName(claimant.first_name);
      setLastName(claimant.last_name);
      setContactNumber(claimant.contact_number || '');
    }
  }, [claimant]);

  const handleSave = async () => {
    if (!claimant) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      toast({ title: 'Validation Error', description: 'First name and surname are required.', variant: 'destructive' });
      return;
    }

    if (!/^[a-zA-Z\s'-]+$/.test(trimmedFirst) || !/^[a-zA-Z\s'-]+$/.test(trimmedLast)) {
      toast({ title: 'Validation Error', description: 'Names can only contain letters, spaces, hyphens, and apostrophes.', variant: 'destructive' });
      return;
    }

    const trimmedContact = contactNumber.trim();
    if (trimmedContact && !/^[0-9\s()+\-]*$/.test(trimmedContact)) {
      toast({ title: 'Validation Error', description: 'Contact number can only contain digits, spaces, and phone symbols.', variant: 'destructive' });
      return;
    }

    // Check for duplicates if name changed
    if (trimmedFirst.toLowerCase() !== claimant.first_name.toLowerCase() || trimmedLast.toLowerCase() !== claimant.last_name.toLowerCase()) {
      const { data: existing } = await supabase
        .from('claimants')
        .select('id')
        .eq('referring_attorney_id', claimant.referring_attorney_id)
        .ilike('first_name', trimmedFirst)
        .ilike('last_name', trimmedLast)
        .neq('id', claimant.id);

      if (existing && existing.length > 0) {
        toast({ title: 'Duplicate detected', description: `A claimant named "${trimmedFirst} ${trimmedLast}" already exists for this attorney.`, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claimants')
        .update({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          contact_number: trimmedContact || null,
        })
        .eq('id', claimant.id);

      if (error) throw error;

      toast({ title: 'Claimant updated', description: `${trimmedFirst} ${trimmedLast} has been updated.` });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update claimant.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Claimant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-first-name">First Name</Label>
            <Input id="edit-first-name" value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-last-name">Surname</Label>
            <Input id="edit-last-name" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-contact">Contact Number</Label>
            <Input id="edit-contact" value={contactNumber} onChange={e => setContactNumber(e.target.value)} maxLength={20} placeholder="e.g. 012 345 6789" />
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">Auto ID: <span className="font-mono font-medium text-foreground">{claimant?.auto_id}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Referring attorney cannot be changed to protect data integrity.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditClaimantDialog;
