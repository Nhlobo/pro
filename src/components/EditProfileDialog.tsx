import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { UserProfile } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, User, Briefcase, Building } from 'lucide-react';

interface ReferringAttorney {
  id: string;
  name: string;
  code: string;
  contact_person?: string;
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  referringAttorneys: ReferringAttorney[];
  referringAttorneysLoading: boolean;
  onProfileUpdated: () => void;
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  open,
  onOpenChange,
  user,
  referringAttorneys,
  referringAttorneysLoading,
  onProfileUpdated,
}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    position: '',
    userType: '',
    referringAttorneyId: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        position: user.position || '',
        userType: user.user_type || 'employee',
        referringAttorneyId: user.referring_attorney_id || '',
      });
    }
  }, [user]);

  const handleUpdate = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      // Update profile fields
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.firstName.trim() || null,
          last_name: form.lastName.trim() || null,
          email: form.email.trim() || null,
          position: form.position || null,
          user_type: form.userType || null,
          referring_attorney_id: form.referringAttorneyId || null,
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
      }

      toast.success('User profile updated successfully');
      onProfileUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Edit User Profile
          </DialogTitle>
          <DialogDescription>
            Update all profile details for {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Personal Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Personal Information</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="editProfileFirstName" className="text-xs">First Name</Label>
                <Input
                  id="editProfileFirstName"
                  value={form.firstName}
                  onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="editProfileLastName" className="text-xs">Last Name</Label>
                <Input
                  id="editProfileLastName"
                  value={form.lastName}
                  onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="editProfileEmail" className="text-xs">Email Address</Label>
            <Input
              id="editProfileEmail"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="user@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Note: This updates the profile email only, not the login credentials.
            </p>
          </div>

          <Separator />

          {/* Role & Position */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Role & Position</Label>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">User Type</Label>
                <Select value={form.userType} onValueChange={(value) => setForm(prev => ({ ...prev, userType: value, position: value !== 'employee' ? '' : prev.position, referringAttorneyId: value !== 'referring_attorney' ? '' : prev.referringAttorneyId }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="employee">Company Employee</SelectItem>
                    <SelectItem value="referring_attorney">Referring Attorney</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.userType === 'employee' && (
                <div>
                  <Label className="text-xs">Position</Label>
                  <Select value={form.position} onValueChange={(value) => setForm(prev => ({ ...prev, position: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin Assistant">Admin Assistant</SelectItem>
                      <SelectItem value="Medico Legal Manager">Medico Legal Manager</SelectItem>
                      <SelectItem value="Case Manager">Case Manager</SelectItem>
                      <SelectItem value="Legal Secretary">Legal Secretary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Attorney Link */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Linked Referring Attorney</Label>
            </div>
            <Select
              value={form.referringAttorneyId || 'none'}
              onValueChange={(value) => setForm(prev => ({ ...prev, referringAttorneyId: value === 'none' ? '' : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select referring attorney" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {referringAttorneysLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  referringAttorneys.map((attorney) => (
                    <SelectItem key={attorney.id} value={attorney.id}>
                      {attorney.name} ({attorney.code})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Link this user to a referring attorney for appointment access.
            </p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 bg-gradient-to-r from-primary to-secondary text-white"
            >
              {isUpdating ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
