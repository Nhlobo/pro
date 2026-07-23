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
import { usePermissions } from "@/hooks/usePermissions";
import { AdminPagination, AdminEmptyState } from "@/components/admin/ui/AdminUI";
import { cn } from "@/lib/utils";

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

interface ReferringAttorneyListProps {
  /** Rendered inside the Admin Attorney CRM's "All Attorneys" tab instead of
   *  as its own route. */
  embedded?: boolean;
}

const ReferringAttorneyList: React.FC<ReferringAttorneyListProps> = ({ embedded = false }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [attorneys, setAttorneys] = useState<ReferringAttorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attorneyToDelete, setAttorneyToDelete] = useState<ReferringAttorney | null>(null);
  const [duplicateNames, setDuplicateNames] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

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

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredAttorneys.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pagedAttorneys = embedded ? filteredAttorneys.slice(pageStart, pageEnd) : filteredAttorneys;

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

  const directoryCard = (
    <Card className={embedded ? "rounded-none border-black/10 shadow-none" : ""}>
      <CardHeader className={embedded ? "border-b border-black/10" : ""}>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Referring Attorneys Directory
        </CardTitle>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, code, or province..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={embedded ? "rounded-none border-black/15 pl-9" : "pl-9"}
          />
        </div>
      </CardHeader>
      <CardContent className={embedded ? "p-0" : undefined}>
        {embedded ? (
          // Paginated card list — every attorney's details stay fully
          // readable on a phone without a sideways-scrolling 9-column
          // table, and pagination keeps this from turning into an
          // endless vertical scroll once the directory grows.
          loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse bg-black/[0.03]" />
              ))}
            </div>
          ) : pagedAttorneys.length === 0 ? (
            <AdminEmptyState
              icon={Building2}
              title="No referring attorneys found"
              description={searchTerm ? "Try adjusting your search terms." : "Attorneys you add will appear here."}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-px bg-black/10 p-px sm:grid-cols-2 xl:grid-cols-3">
                {pagedAttorneys.map((attorney) => (
                  <div
                    key={attorney.id}
                    className={cn(
                      "flex flex-col gap-2.5 bg-white p-4 transition-colors hover:bg-black/[0.02]",
                      isDuplicateName(attorney.name) && "bg-destructive/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isDuplicateName(attorney.name) && (
                          <span className="text-destructive" title="Exact duplicate name detected — please correct or delete one entry">🚩</span>
                        )}
                        <span className="truncate font-semibold text-black">{attorney.name}</span>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">{attorney.code}</span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="truncate"><span className="text-slate-400">Contact </span>{attorney.contact_person || '–'}</div>
                      <div className="flex items-center gap-1.5">
                        <SecureDataDisplay
                          data={attorney.phone_masked}
                          type="phone"
                          label=""
                          showIcon={false}
                          requiresPermission="view_referring_attorney_contacts"
                          className="text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <SecureDataDisplay
                          data={attorney.email_masked}
                          type="email"
                          label=""
                          showIcon={false}
                          requiresPermission="view_referring_attorney_contacts"
                          className="text-xs"
                        />
                      </div>
                      <div className="truncate"><span className="text-slate-400">Province </span>{attorney.province || '–'}</div>
                    </div>

                    <div className="flex items-center justify-between border-t border-black/5 pt-2.5">
                      <div className="flex items-center gap-2">
                        {getRoleBadge(attorney.attorney_role)}
                        {attorney.created_at && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(attorney.created_at), 'dd/MM/yy')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(attorney.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin() && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteClick(attorney)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <AdminPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredAttorneys.length}
                startIndex={pageStart}
                endIndex={pageEnd}
              />
            </>
          )
        ) : (
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
                          {isAdmin() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(attorney)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!embedded && filteredAttorneys.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            No referring attorneys found. {searchTerm && "Try adjusting your search terms."}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const deleteDialog = (
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
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button asChild size="sm" className="rounded-none bg-black hover:bg-black/90">
            <Link to="/referring-attorney">Add New Attorney</Link>
          </Button>
        </div>
        {directoryCard}
        {deleteDialog}
      </div>
    );
  }

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
        {directoryCard}
      </main>

      {deleteDialog}

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyList;
