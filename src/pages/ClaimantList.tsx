import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Search, Download, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import EditClaimantDialog from "@/components/EditClaimantDialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";

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

const ClaimantList: React.FC = () => {
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [filteredClaimants, setFilteredClaimants] = useState<Claimant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedClaimants, setSelectedClaimants] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingClaimant, setEditingClaimant] = useState<Claimant | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

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

    // Set up real-time subscription for new claimants
    const channel = supabase
      .channel('claimants-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'claimants'
        },
        (payload) => {
          console.log('New claimant added:', payload);
          fetchClaimants(); // Refresh the list when new claimant is added
          toast({
            title: "New claimant added",
            description: `${payload.new.first_name} ${payload.new.last_name} has been added to the list.`,
          });
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Claimant List | Medico-Legal</title>
        <meta name="description" content="View and manage all claimants in the medico-legal system. Search, filter, and export claimant data." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          
          <div className="flex items-center gap-3">
            {selectedClaimants.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedClaimants.size})
              </Button>
            )}
            <Button asChild>
              <Link to="/claimant" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Claimant
              </Link>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Claimants ({filteredClaimants.length})</span>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search claimants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading claimants...</div>
              </div>
            ) : filteredClaimants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchTerm ? "No claimants found matching your search." : "No claimants found."}
                </p>
                {!searchTerm && (
                  <Button asChild className="mt-4">
                    <Link to="/claimant">Add First Claimant</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedClaimants.size === filteredClaimants.length && filteredClaimants.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Auto ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Number</TableHead>
                      <TableHead>Referring Attorney</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
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
                          <Badge variant="outline">{claimant.auto_id}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {claimant.first_name} {claimant.last_name}
                        </TableCell>
                        <TableCell>
                          {claimant.contact_number || (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {claimant.referring_attorneys?.name || (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(claimant.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
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
          </CardContent>
        </Card>
      </main>
      <EditClaimantDialog
        claimant={editingClaimant}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={fetchClaimants}
      />
      <CompanyFooter />
    </div>
  );
};

export default ClaimantList;