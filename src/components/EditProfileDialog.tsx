import React, { useState, useEffect } from 'react';
import {
  Sheet as Dialog,
  SheetContent as DialogContent,
  SheetDescription as DialogDescription,
  SheetHeader as DialogHeader,
  SheetTitle as DialogTitle,
} from '@/components/ui/sheet';
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
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  ROLE_LABELS as ROLE_DISPLAY_NAMES,
  fetchStaffPositions,
  positionsForRole,
  defaultPositionForRole,
  type StaffPositionRow,
} from '@/lib/rolePosition';

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
  });
  const [selectedAttorneyIds, setSelectedAttorneyIds] = useState<string[]>([]);
  const [attorneySearch, setAttorneySearch] = useState('');
  const [matterTypeFilter, setMatterTypeFilter] = useState<string>('all');
  const [attorneyMatterTypes, setAttorneyMatterTypes] = useState<Record<string, string[]>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  // Staff positions (staff_positions) — the same role↔position source of
  // truth Manage Access uses (src/lib/rolePosition.ts). The "Position"
  // field below used to offer all 6 positions regardless of the person's
  // System Role, so e.g. a Sales Consultant could be labeled "Director".
  // It's now restricted to whatever role_key matches user.role.
  const [staffPositions, setStaffPositions] = useState<StaffPositionRow[]>([]);

  useEffect(() => {
    fetchStaffPositions().then(setStaffPositions);
  }, []);

  useEffect(() => {
    if (user && open) {
      setForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        position: user.position || '',
      });
      setAttorneySearch('');
      setMatterTypeFilter('all');
      // Fetch existing attorney links and matter type data
      fetchUserAttorneyLinks(user.id);
      fetchAttorneyMatterTypes();
    }
  }, [user, open]);

  // Positions valid for this person's actual System Role. When their
  // current `position` value isn't one of them (stale/invalid, e.g. a
  // leftover "Medical Legal Manager") or is empty, and the role has exactly
  // one valid position, default to it instead of leaving an invalid or
  // blank display title in place.
  const validPositions = user ? positionsForRole(staffPositions, user.role) : [];
  useEffect(() => {
    if (!user || !open || staffPositions.length === 0) return;
    const valid = positionsForRole(staffPositions, user.role);
    const currentIsValid = valid.some((p) => p.display_name === form.position);
    if (!currentIsValid) {
      const only = defaultPositionForRole(staffPositions, user.role);
      if (only) setForm((prev) => ({ ...prev, position: only.display_name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open, staffPositions]);

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
      // NOTE: user_type is intentionally NOT written here anymore -- see
      // the Role & Position section below for why. Only fields this
      // dialog actually lets someone edit are updated.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.firstName.trim() || null,
          last_name: form.lastName.trim() || null,
          email: form.email.trim() || null,
          position: form.position || null,
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
      <DialogContent side="right" className="h-full w-full overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" style={{ color: BRAND_TEAL }} />
            Edit User Profile
          </DialogTitle>
          <DialogDescription>
            {user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user.email}
            {' - '}
            {/* FIXED 2026-08-31: was reading user.user_type (a legacy,
                independently-editable display field that had drifted out of
                sync for several accounts) and only recognized 3 of the 5
                real roles, so Sales Consultant/Finance/Director staff all
                showed up as generic "User" here. Now reads the real,
                always-correct role from user.role instead. */}
            {ROLE_DISPLAY_NAMES[user.role ?? ''] ?? 'User'}
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
                  className="rounded-none border-black/15"
                  value={form.firstName}
                  onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="editProfileLastName" className="text-xs">Last Name</Label>
                <Input
                  id="editProfileLastName"
                  className="rounded-none border-black/15"
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
              className="rounded-none border-black/15"
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
                <Label className="text-xs">Role</Label>
                {/* FIXED 2026-08-31: this used to be an independently-editable
                    "User Type" dropdown that only offered Administrator,
                    Company Employee, and Referring Attorney -- Sales
                    Consultant, Finance, and Director were never options,
                    so those accounts could never be labeled correctly here.
                    It also wrote straight to profiles.user_type, completely
                    separate from the real role (user_roles /
                    access_role_assignments) set in "System Role" above in
                    Manage Access -- exactly the kind of two-sources-of-truth
                    drift that broke several staff accounts earlier. Role is
                    now shown read-only, always correct, sourced from the
                    same place access control actually reads from. */}
                <div className="mt-1 flex h-9 items-center border border-black/15 bg-black/[0.02] px-3 text-sm text-slate-700">
                  {ROLE_DISPLAY_NAMES[user.role ?? ''] ?? 'User'}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  To change this person's role, use <strong>System Role</strong> in Manage Access instead.
                </p>
              </div>

              <div>
                <Label className="text-xs">Position (display title)</Label>
                <Select
                  value={form.position}
                  onValueChange={(value) => setForm(prev => ({ ...prev, position: value }))}
                  disabled={validPositions.length === 0}
                >
                  <SelectTrigger className="rounded-none border-black/15">
                    <SelectValue placeholder={validPositions.length === 0 ? 'No positions defined for this role' : 'Select position'} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Restricted to positions valid for this person's System Role
                        (see Role field above) — the same role↔position rules Manage
                        Access enforces, so the two screens can't disagree. */}
                    {validPositions.map((p) => (
                      <SelectItem key={p.position_key} value={p.display_name}>{p.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  This is a display title only (shown on their card in the directory). It does not
                  control what they can see — that's set by System Role and Staff Position in
                  Manage Access, above the module list. Options are limited to positions valid for
                  their System Role above.
                </p>
              </div>
            </div>
          </div>

          {/* Sales Performance Stats — visible for Sales Consultants */}
          {(form.position === 'Sales Consultant' || user?.position === 'Sales Consultant') && (
            <>
              <Separator />
              <SalesConsultantStats userId={user?.id} firstName={form.firstName} lastName={form.lastName} />
            </>
          )}

          <Separator />

          {/* Attorney Links - Multi-select */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Linked Referring Attorneys</Label>
              </div>
              <Badge variant="outline" className="rounded-none text-xs">
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
                  <SelectTrigger className="h-8 rounded-none border-black/15 text-xs">
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
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-none border-black/15 text-xs text-black hover:bg-black/5 whitespace-nowrap"
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
                  className="rounded-none border-black/15 pl-8 h-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="w-full rounded-none border-black/15 text-black hover:bg-black/5 text-xs"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                {allSelected ? 'Deselect All' : 'Select All Referring Attorneys'}
              </Button>
            </div>

            {/* Attorney List */}
            <ScrollArea className="h-48 rounded-none border border-black/15 p-2">
              {referringAttorneysLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading attorneys...</p>
              ) : filteredAttorneys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No attorneys found</p>
              ) : (
                <div className="space-y-1">
                  {filteredAttorneys.map((attorney) => (
                    <div
                      key={attorney.id}
                      className={`flex items-center gap-2 rounded-none p-2 cursor-pointer hover:bg-black/5 transition-colors ${
                        selectedAttorneyIds.includes(attorney.id) ? 'border border-black/20 bg-black/[0.03]' : 'border border-transparent'
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
                            <Badge key={mt} variant="outline" className="h-4 shrink-0 rounded-none px-1 py-0 text-[10px]">
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
              className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 rounded-none text-white hover:opacity-90"
              style={{ backgroundColor: BRAND_TEAL }}
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
