import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SecureDataDisplay } from "@/components/SecureDataDisplay";
import { ArrowLeft, Search, Building2, Pencil, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";

type ReferringAttorney = {
  id: string;
  name: string;
  contact_person: string;
  phone_masked: string;
  email_masked: string;
  attorney_role: string;
  province: string;
  code: string;
  created_at: string;
};

const ReferringAttorneyList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [attorneys, setAttorneys] = useState<ReferringAttorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attorneyToDelete, setAttorneyToDelete] = useState<ReferringAttorney | null>(null);
  const [duplicateNames, setDuplicateNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAttorneys();
  }, []);

  const fetchAttorneys = async () => {
    try {
      setLoading(true);
      // Query referring attorneys directly to access is_system_company field
      const { data, error } = await supabase
        .from('referring_attorneys')
        .select('id, name, contact_person, phone, email, attorney_role, province, code, created_at, is_system_company')
        .order('name');

      if (error) {
        console.error('Error fetching attorneys:', error);
        toast({
          title: "Error",
          description: "Failed to fetch referring attorneys. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Filter out system companies (like Kutlwano Associate)
      const filteredData = (data || []).filter(attorney => !attorney.is_system_company);
      
      // Mask sensitive data for display
      const maskedData = filteredData.map(attorney => ({
        ...attorney,
        phone_masked: attorney.phone || 'N/A',
        email_masked: attorney.email || 'N/A',
      }));

      // First, identify exact duplicate names (case-insensitive exact matches only)
      const nameCount = new Map<string, number>();
      maskedData.forEach(attorney => {
        const name = attorney.name?.trim() || '';
        if (name) {
          // Use original casing for comparison but normalize for duplicate detection
          const normalizedName = name.toLowerCase();
          nameCount.set(normalizedName, (nameCount.get(normalizedName) || 0) + 1);
        }
      });

      // Set of exact names that appear more than once
      const duplicates = new Set<string>();
      nameCount.forEach((count, name) => {
        if (count > 1) {
          duplicates.add(name);
        }
      });
      setDuplicateNames(duplicates);

      // Deduplicate attorneys using utility function for display
      const uniqueData = deduplicateAttorneys(maskedData);
      setAttorneys(uniqueData);

      // Show warning if exact duplicates exist
      if (duplicates.size > 0) {
        toast({
          title: "🚩 Exact Duplicate Names Detected",
          description: `${duplicates.size} referring attorney name(s) have exact duplicates. Look for red flags (🚩) in the list and correct or delete duplicate entries.`,
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAttorneys = attorneys.filter(attorney =>
    (attorney.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (attorney.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (attorney.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (attorney.province || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMatterTypeBadge = (matterType: string) => {
    switch (matterType) {
      case "mva": return <Badge variant="default">MVA</Badge>;
      case "med_neg": return <Badge variant="secondary">Med Neg</Badge>;
      case "both": return <Badge variant="outline">Both</Badge>;
      default: return <Badge variant="secondary">{matterType}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    return (
      <Badge variant={role === "Plaintiff" ? "default" : "secondary"}>
        {role}
      </Badge>
    );
  };

  const isDuplicateName = (name: string) => {
    return duplicateNames.has(name?.toLowerCase().trim() || '');
  };

  const handleDeleteClick = (attorney: ReferringAttorney) => {
    setAttorneyToDelete(attorney);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attorneyToDelete) return;

    try {
      const { error } = await supabase
        .from('referring_attorneys')
        .delete()
        .eq('id', attorneyToDelete.id);

      if (error) {
        console.error('Error deleting attorney:', error);
        toast({
          title: "Error",
          description: "Failed to delete attorney. You may not have permission.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Attorney deleted successfully.",
      });

      // Refresh the list
      await fetchAttorneys();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAttorneyToDelete(null);
    }
  };

  const handleEdit = (attorneyId: string) => {
    navigate(`/referring-attorney/${attorneyId}`);
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/referring-attorney-list';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney List - Medico-Legal Assessment System</title>
        <meta name="description" content="View and manage all referring attorneys with their contact details, roles, and matter types." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Referring Attorney List</h1>
            </div>
            <Button asChild>
              <Link to="/referring-attorney">
                Add New Attorney
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Referring Attorneys Directory
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, code, or province..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Referring Attorney Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Date Captured</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading attorneys...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttorneys.map((attorney) => (
                      <TableRow key={attorney.id} className={isDuplicateName(attorney.name) ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{attorney.code}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isDuplicateName(attorney.name) && (
                              <span className="text-destructive text-lg" title="Exact duplicate name detected - please correct or delete one entry">
                                🚩
                              </span>
                            )}
                            <span>{attorney.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{attorney.contact_person}</TableCell>
                        <TableCell>
                          <SecureDataDisplay
                            data={attorney.phone_masked}
                            type="phone"
                            label=""
                            showIcon={false}
                            requiresPermission="view_referring_attorney_contacts"
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <SecureDataDisplay
                            data={attorney.email_masked}
                            type="email"
                            label=""
                            showIcon={false}
                            requiresPermission="view_referring_attorney_contacts"
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>{attorney.province}</TableCell>
                        <TableCell>
                          {getRoleBadge(attorney.attorney_role)}
                        </TableCell>
                        <TableCell>
                          {attorney.created_at && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(attorney.created_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(attorney.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(attorney)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {filteredAttorneys.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No referring attorneys found. {searchTerm && "Try adjusting your search terms."}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the attorney "{attorneyToDelete?.name}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyList;