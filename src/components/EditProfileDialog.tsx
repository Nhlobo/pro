import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { UserProfile } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, User, Briefcase, Building, Search, CheckSquare, Filter } from 'lucide-react';
import SalesConsultantStats from '@/components/SalesConsultantStats';

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
  });
  const [selectedAttorneyIds, setSelectedAttorneyIds] = useState<string[]>([]);
  const [attorneySearch, setAttorneySearch] = useState('');
  const [matterTypeFilter, setMatterTypeFilter] = useState<string>('all');
  const [attorneyMatterTypes, setAttorneyMatterTypes] = useState<Record<string, string[]>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user && open) {
      setForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        position: user.position || '',
        userType: user.user_type || 'employee',
      });
      setAttorneySearch('');
      setMatterTypeFilter('all');
      // Fetch existing attorney links and matter type data
      fetchUserAttorneyLinks(user.id);
      fetchAttorneyMatterTypes();
    }
  }, [user, open]);

  const fetchAttorneyMatterTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('referring_attorney_id, matter_type')
        .not('matter_type', 'is', null)
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching attorney matter types:', error);
        return;
      }

      const mapping: Record<string, string[]> = {};
      (data || []).forEach((row) => {
        if (!mapping[row.referring_attorney_id]) {
          mapping[row.referring_attorney_id] = [];
        }
        if (row.matter_type && !mapping[row.referring_attorney_id].includes(row.matter_type)) {
          mapping[row.referring_attorney_id].push(row.matter_type);
        }
      });
      setAttorneyMatterTypes(mapping);
    } catch (err) {
      console.error('Failed to fetch attorney matter types:', err);
    }
  };

  const fetchUserAttorneyLinks = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_attorney_links')
        .select('referring_attorney_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching attorney links:', error);
        return;
      }

      const ids = (data || []).map(d => d.referring_attorney_id);
      setSelectedAttorneyIds(ids);
    } catch (err) {
      console.error('Failed to fetch attorney links:', err);
    }
  };

  const handleSelectAll = () => {
    if (selectedAttorneyIds.length === referringAttorneys.length) {
      setSelectedAttorneyIds([]);
    } else {
      setSelectedAttorneyIds(referringAttorneys.map(a => a.id));
    }
  };

  const handleToggleAttorney = (attorneyId: string) => {
    setSelectedAttorneyIds(prev =>
      prev.includes(attorneyId)
        ? prev.filter(id => id !== attorneyId)
        : [...prev, attorneyId]
    );
  };

  const filteredAttorneys = referringAttorneys.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(attorneySearch.toLowerCase()) ||
      a.code.toLowerCase().includes(attorneySearch.toLowerCase());
    
    if (matterTypeFilter === 'all') return matchesSearch;
    
    const matters = attorneyMatterTypes[a.id] || [];
    if (matterTypeFilter === 'MVA') return matchesSearch && matters.includes('MVA');
    if (matterTypeFilter === 'Medical Negligence') return matchesSearch && matters.includes('Medical Negligence');
    if (matterTypeFilter === 'Both') return matchesSearch && matters.includes('MVA') && matters.includes('Medical Negligence');
    return matchesSearch;
  });

  const handleAutoAllocateByMatter = (matterType: string) => {
    const matchingIds = referringAttorneys
      .filter(a => {
        const matters = attorneyMatterTypes[a.id] || [];
        if (matterType === 'MVA') return matters.includes('MVA');
        if (matterType === 'Medical Negligence') return matters.includes('Medical Negligence');
        if (matterType === 'Both') return matters.includes('MVA') && matters.includes('Medical Negligence');
        return false;
      })
      .map(a => a.id);
    
    setSelectedAttorneyIds(prev => {
      const combined = new Set([...prev, ...matchingIds]);
      return Array.from(combined);
    });
    toast.success(`Auto-linked ${matchingIds.length} attorneys for ${matterType} matters`);
  };

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
          // Keep referring_attorney_id for backward compat — set to first selected or null
          referring_attorney_id: selectedAttorneyIds.length > 0 ? selectedAttorneyIds[0] : null,
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
      }

      // Sync attorney links: delete all, then insert selected
      const { error: deleteError } = await supabase
        .from('user_attorney_links')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error clearing attorney links:', deleteError);
        throw deleteError;
      }

      if (selectedAttorneyIds.length > 0) {
        const rows = selectedAttorneyIds.map(attorneyId => ({
          user_id: user.id,
          referring_attorney_id: attorneyId,
        }));

        const { error: insertError } = await supabase
          .from('user_attorney_links')
          .insert(rows);

        if (insertError) {
          console.error('Error inserting attorney links:', insertError);
          throw insertError;
        }
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

  const allSelected = referringAttorneys.length > 0 && selectedAttorneyIds.length === referringAttorneys.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Edit User Profile
          </DialogTitle>
          <DialogDescription>
            {user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user.email}
            {' - '}
            {user.user_type === 'admin' ? 'Administrator' : 
             user.user_type === 'employee' ? 'Company Employee' :
             user.user_type === 'referring_attorney' ? 'Referring Attorney' : 
             'User'}
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
                <Select value={form.userType} onValueChange={(value) => setForm(prev => ({ ...prev, userType: value, position: value !== 'employee' ? '' : prev.position }))}>
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
                      <SelectItem value="Sales Consultant">Sales Consultant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Attorney Links - Multi-select */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Linked Referring Attorneys</Label>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedAttorneyIds.length} of {referringAttorneys.length} selected
              </Badge>
            </div>

            {/* Matter Type Filter & Auto-Allocate */}
            <div className="space-y-2 mb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium">Link by Matter Type</Label>
              </div>
              <div className="flex gap-2">
                <Select value={matterTypeFilter} onValueChange={setMatterTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filter by matter type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attorneys</SelectItem>
                    <SelectItem value="MVA">MVA Matter</SelectItem>
                    <SelectItem value="Medical Negligence">Med Neg Matter</SelectItem>
                    <SelectItem value="Both">Both MVA & Med Neg</SelectItem>
                  </SelectContent>
                </Select>
                {matterTypeFilter !== 'all' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs whitespace-nowrap"
                    onClick={() => handleAutoAllocateByMatter(matterTypeFilter)}
                  >
                    Auto-Link {matterTypeFilter === 'Both' ? 'Both' : matterTypeFilter}
                  </Button>
                )}
              </div>
            </div>

            {/* Search & Select All */}
            <div className="space-y-2 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search attorneys..."
                  value={attorneySearch}
                  onChange={(e) => setAttorneySearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="w-full text-xs"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                {allSelected ? 'Deselect All' : 'Select All Referring Attorneys'}
              </Button>
            </div>

            {/* Attorney List */}
            <ScrollArea className="h-48 border rounded-md p-2">
              {referringAttorneysLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading attorneys...</p>
              ) : filteredAttorneys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No attorneys found</p>
              ) : (
                <div className="space-y-1">
                  {filteredAttorneys.map((attorney) => (
                    <div
                      key={attorney.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedAttorneyIds.includes(attorney.id) ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
                      }`}
                      onClick={() => handleToggleAttorney(attorney.id)}
                    >
                      <Checkbox
                        checked={selectedAttorneyIds.includes(attorney.id)}
                        onCheckedChange={() => handleToggleAttorney(attorney.id)}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium truncate">{attorney.name}</p>
                          {(attorneyMatterTypes[attorney.id] || []).map(mt => (
                            <Badge key={mt} variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                              {mt === 'Medical Negligence' ? 'Med Neg' : mt}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{attorney.code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-1">
              Select all attorneys to grant the same data access as an administrator.
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
