import React, { useEffect, useState, Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Plus, Search, Download, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import EditClaimantDialog from "@/components/EditClaimantDialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { AdminPagination, AdminEmptyState, AdminCard, AdminCardHeader, AdminCardBody, AdminPill } from "@/components/admin/ui/AdminUI";
import DashboardStickyHeader from "@/components/dashboard/DashboardStickyHeader";

const ClaimantFormModule = lazy(() => import("@/components/admin/ClaimantFormModule"));

/** Loading state shown inside the sliding panel while the form chunk loads —
 *  mirrors the loading skeleton used by the other admin sliding panels
 *  (e.g. Expert Network's "New Expert" panel) so every panel feels the same. */
const PanelFallback = () => (
  <div className="space-y-4 p-1">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
    <Skeleton className="h-48 w-full" />
  </div>
);

interface Claimant {
  id: string;
  first_name: string;
  last_name: string;
  contact_number?: string;
  auto_id: string;
  created_at: string;
  referring_attorney_id: string;
  referring_attorneys?: {
    name: string;
    contact_person?: string;
  };
}

interface ClaimantListProps {
  /** Rendered inside the Admin Attorney CRM's "All Claimants" tab instead of
   *  as its own route. Suppresses the standalone page chrome (SEO tags,
   *  "Back to Dashboard" button, footer) and adopts the flat enterprise
   *  table styling used across the rest of the CRM, so the tab reads as
   *  one continuous screen instead of a page nested inside a page. */
  embedded?: boolean;
}

const ClaimantList: React.FC<ClaimantListProps> = ({ embedded = false }) => {
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [filteredClaimants, setFilteredClaimants] = useState<Claimant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedClaimants, setSelectedClaimants] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingClaimant, setEditingClaimant] = useState<Claimant | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const confirm = useConfirm();
  const PAGE_SIZE = 12;

  const fetchClaimants = async () => {
    try {
      // Query claimants with referring attorney information
      const { data, error } = await supabase
        .from('claimants')
        .select(`
          id,
          first_name,
          last_name,
          contact_number,
          auto_id,
          created_at,
          referring_attorney_id,
          referring_attorneys!claimants_law_firm_id_fkey (
            name,
            contact_person
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClaimants(data || []);
      setFilteredClaimants(data || []);
    } catch (error: any) {
      console.error('Error loading claimants:', error);
      toast({
        title: "Error loading claimants",
        description: error.message || "Failed to load claimant list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimants();

    // Set up real-time subscription for claimant changes (insert, update, delete).
    // Previously this only listened for INSERT, so editing or deleting a
    // claimant never refreshed this list for anyone already on the page.
    const channel = supabase
      .channel('claimants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'claimants'
        },
        (payload) => {
          console.log('Claimant change received:', payload);
          fetchClaimants(); // Refresh the list on any insert/update/delete
          if (payload.eventType === 'INSERT' && payload.new) {
            toast({
              title: "New claimant added",
              description: `${payload.new.first_name} ${payload.new.last_name} has been added to the list.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredClaimants(claimants);
    } else {
      const filtered = claimants.filter(claimant =>
        claimant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claimant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claimant.auto_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claimant.referring_attorneys?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClaimants(filtered);
    }
  }, [searchTerm, claimants]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredClaimants.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pagedClaimants = embedded ? filteredClaimants.slice(pageStart, pageEnd) : filteredClaimants;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaimants(new Set(filteredClaimants.map(c => c.id)));
    } else {
      setSelectedClaimants(new Set());
    }
  };

  const handleSelectClaimant = (claimantId: string, checked: boolean) => {
    const newSelected = new Set(selectedClaimants);
    if (checked) {
      newSelected.add(claimantId);
    } else {
      newSelected.delete(claimantId);
    }
    setSelectedClaimants(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedClaimants.size === 0) return;

    const confirmed = await confirm({
      title: 'Delete claimants?',
      description: `Are you sure you want to delete ${selectedClaimants.size} claimant(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("claimants")
        .delete()
        .in("id", Array.from(selectedClaimants));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully deleted ${selectedClaimants.size} claimant(s)`,
      });
      setSelectedClaimants(new Set());
      await fetchClaimants();
    } catch (error: any) {
      console.error("Error deleting claimants:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete claimants",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;

      pdf.setFontSize(20);
      pdf.text("Claimants List", pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: "center" });

      const tableData = filteredClaimants.map((claimant) => [
        claimant.auto_id,
        claimant.first_name,
        claimant.last_name,
        claimant.contact_number || "N/A",
        claimant.referring_attorneys?.name || "N/A",
      ]);

      autoTable(pdf, {
        head: [["Auto ID", "First Name", "Last Name", "Contact Number", "Referring Attorney"]],
        body: tableData,
        startY: 40,
        theme: "grid",
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });

      pdf.save(`claimants-list-${new Date().toISOString().split("T")[0]}.pdf`);
      toast({
        title: "Success",
        description: "PDF exported successfully",
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/claimant-list';

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {selectedClaimants.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="rounded-none"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selectedClaimants.size})
          </Button>
        )}
        <Button
          size="sm"
          className="flex items-center gap-2 rounded-none bg-black hover:bg-black/90"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add New Claimant
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-none border-black/15"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export PDF"}
        </Button>
      </div>
    </div>
  );

  const listCard = (
    <AdminCard>
      <AdminCardHeader
        title={`Claimants (${filteredClaimants.length})`}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search claimants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-none border-black/15 pl-9"
            />
          </div>
        }
      />
      <AdminCardBody className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading claimants...</div>
          </div>
        ) : filteredClaimants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">
              {searchTerm ? "No claimants found matching your search." : "No claimants found."}
            </p>
            {!searchTerm && (
              <Button asChild className="mt-4 rounded-none bg-black hover:bg-black/90">
                <Link to="/claimant">Add First Claimant</Link>
              </Button>
            )}
          </div>
        ) : embedded ? (
          // Paginated card list — keeps every claimant's key fields visible
          // at a glance on any screen size, no sideways scroll and no
          // never-ending vertical list.
          <>
            <div className="grid grid-cols-1 gap-px bg-black/10 p-px sm:grid-cols-2 xl:grid-cols-3">
              {pagedClaimants.map((claimant) => (
                <div key={claimant.id} className="flex flex-col gap-2.5 bg-white p-4 transition-colors hover:bg-black/[0.02]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        checked={selectedClaimants.has(claimant.id)}
                        onCheckedChange={(checked) => handleSelectClaimant(claimant.id, checked as boolean)}
                      />
                      <span className="truncate font-semibold text-black">
                        {claimant.first_name} {claimant.last_name}
                      </span>
                    </div>
                    <AdminPill className="shrink-0 font-mono">{claimant.auto_id}</AdminPill>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="truncate">
                      <span className="text-slate-400">Contact </span>
                      {claimant.contact_number || 'N/A'}
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Attorney </span>
                      {claimant.referring_attorneys?.name || 'N/A'}
                    </div>
                    <div>
                      <span className="text-slate-400">Added </span>
                      {format(new Date(claimant.created_at), "dd/MM/yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-black/5 pt-2.5">
                    <AdminPill tone="success">Active</AdminPill>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => { setEditingClaimant(claimant); setEditDialogOpen(true); }}
                      title="Edit claimant"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <AdminPagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredClaimants.length}
              startIndex={pageStart}
              endIndex={pageEnd}
            />
          </>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedClaimants.size === filteredClaimants.length && filteredClaimants.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-black">Auto ID</TableHead>
                  <TableHead className="text-xs font-semibold text-black">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-black">Contact Number</TableHead>
                  <TableHead className="text-xs font-semibold text-black">Referring Attorney</TableHead>
                  <TableHead className="text-xs font-semibold text-black">Date Added</TableHead>
                  <TableHead className="text-xs font-semibold text-black">Status</TableHead>
                  <TableHead className="text-xs font-semibold w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaimants.map((claimant) => (
                  <TableRow key={claimant.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedClaimants.has(claimant.id)}
                        onCheckedChange={(checked) => handleSelectClaimant(claimant.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <AdminPill>{claimant.auto_id}</AdminPill>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {claimant.first_name} {claimant.last_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {claimant.contact_number || (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {claimant.referring_attorneys?.name || (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(claimant.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <AdminPill tone="success">Active</AdminPill>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingClaimant(claimant); setEditDialogOpen(true); }}
                        title="Edit claimant"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );

  const editDialog = (
    <EditClaimantDialog
      claimant={editingClaimant}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      onSaved={fetchClaimants}
    />
  );

  // Add New Claimant — same docked sliding panel, identical mechanics to the
  // other admin list pages (e.g. Expert Network's "New Expert" sheet), so
  // staff can glance at the list behind it, cancel, or save without being
  // bounced to a separate route.
  const addSheet = (
    <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-black/10 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-bold text-black">
            <Plus className="h-4 w-4" />
            Add New Claimant
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            Capture claimant details and link to the referring attorney without leaving the list.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-5 py-4">
          <Suspense fallback={<PanelFallback />}>
            <ClaimantFormModule
              onSaved={() => {
                setIsAddOpen(false);
                fetchClaimants();
              }}
            />
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {toolbar}
        {listCard}
        {editDialog}
        {addSheet}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Claimant List | Medico-Legal</title>
        <meta name="description" content="View and manage all claimants in the medico-legal system. Search, filter, and export claimant data." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <DashboardStickyHeader
        title="Claimant List"
        subtitle="Search, filter, and export claimant data."
      />

      <main className="container mx-auto px-4 py-8">
        {toolbar}
        {listCard}
      </main>
      {editDialog}
      {addSheet}
      <CompanyFooter />
    </div>
  );
};

export default ClaimantList;
