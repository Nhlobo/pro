import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormControl } from "@/components/ui/form";
import { Plus, Search } from "lucide-react";
import { useAttorneys } from "@/hooks/useAttorneys";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AttorneySelectorProps {
  onAttorneySelect: (attorneyName: string, attorneyEmail?: string) => void;
  selectedAttorneyName?: string;
  selectedAttorneyEmail?: string;
}

const AttorneySelector = ({ onAttorneySelect, selectedAttorneyName, selectedAttorneyEmail }: AttorneySelectorProps) => {
  const { attorneys, loading, createAttorney } = useAttorneys(true); // Enable fetching all attorneys for admin/employees
  const { toast } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userLawFirmId, setUserLawFirmId] = useState<string | null>(null);
  const [newAttorney, setNewAttorney] = useState({
    name: "",
    email: "",
    location: "",
    phone: "",
    law_firm: "",
    specialization: [] as string[],
  });

  useEffect(() => {
    const getUserLawFirm = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('law_firm_id')
            .eq('id', user.id)
            .single();
          
          if (profile?.law_firm_id) {
            setUserLawFirmId(profile.law_firm_id);
          }
        }
      } catch (error) {
        console.error('Error getting user law firm:', error);
      }
    };

    getUserLawFirm();
  }, []);

  const filteredAttorneys = attorneys.filter(attorney =>
    attorney.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.law_firm?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectExisting = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    if (attorney) {
      onAttorneySelect(attorney.name, attorney.email || "");
    }
  };

  const handleAddNew = async () => {
    if (!newAttorney.name.trim()) {
      toast({
        title: "Error",
        description: "Attorney name is required",
        variant: "destructive",
      });
      return;
    }

    if (!userLawFirmId) {
      toast({
        title: "Error",
        description: "Unable to determine your law firm association. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createAttorney({
        name: newAttorney.name,
        email: newAttorney.email || null,
        location: newAttorney.location || null,
        phone: newAttorney.phone || null,
        law_firm: newAttorney.law_firm || null,
        address: null,
        specialization: newAttorney.specialization,
        status: 'potential',
        law_firm_id: userLawFirmId,
      });

      onAttorneySelect(newAttorney.name, newAttorney.email);
      setIsAddingNew(false);
      setNewAttorney({
        name: "",
        email: "",
        location: "",
        phone: "",
        law_firm: "",
        specialization: [],
      });

      toast({
        title: "Success",
        description: "New attorney added successfully",
      });
    } catch (error) {
      console.error("Error adding attorney:", error);
    }
  };

  if (loading) {
    return (
      <FormControl>
        <Input placeholder="Loading attorneys..." disabled />
      </FormControl>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={selectedAttorneyName || ""} onValueChange={handleSelectExisting}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select existing attorney or add new" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <div className="p-2">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search attorneys..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
              {filteredAttorneys.length > 0 ? (
                filteredAttorneys.map((attorney) => (
                  <SelectItem key={attorney.id} value={attorney.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{attorney.name}</span>
                      {attorney.law_firm && (
                        <span className="text-sm text-muted-foreground">{attorney.law_firm}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  No attorneys found
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Attorney</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Attorney Name *</Label>
                <Input
                  id="name"
                  value={newAttorney.name}
                  onChange={(e) => setNewAttorney({ ...newAttorney, name: e.target.value })}
                  placeholder="Enter attorney name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAttorney.email}
                  onChange={(e) => setNewAttorney({ ...newAttorney, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="law_firm">Law Firm</Label>
                <Input
                  id="law_firm"
                  value={newAttorney.law_firm}
                  onChange={(e) => setNewAttorney({ ...newAttorney, law_firm: e.target.value })}
                  placeholder="Enter law firm name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newAttorney.location}
                  onChange={(e) => setNewAttorney({ ...newAttorney, location: e.target.value })}
                  placeholder="Enter location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newAttorney.phone}
                  onChange={(e) => setNewAttorney({ ...newAttorney, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNew}>
                Add Attorney
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selectedAttorneyName && !attorneys.find(a => a.name === selectedAttorneyName) && (
        <div className="text-sm text-muted-foreground">
          New attorney: {selectedAttorneyName}
        </div>
      )}
    </div>
  );
};

export default AttorneySelector;