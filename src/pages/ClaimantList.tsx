import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
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
  const { toast } = useToast();

  const fetchClaimants = async () => {
    try {
      // Query claimants table directly - RLS policies will handle access control
      const { data, error } = await supabase
        .from('claimants')
        .select(`
          id,
          first_name,
          last_name,
          contact_number,
          auto_id,
          created_at,
          referring_attorney_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const claimantsData = (data || []).map(claimant => ({
        ...claimant,
        referring_attorneys: { name: 'Law Firm', contact_person: 'Contact Person' }
      }));

      setClaimants(claimantsData);
      setFilteredClaimants(claimantsData);
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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Create PDF
      const doc = new jsPDF();
      
      // Add branding
      const startY = addBrandingToPDF(doc, 'Claimants List');
      
      // Prepare table data
      const tableHeaders = ['Auto ID', 'Name', 'Contact Number', 'Referring Attorney', 'Date Added'];
      const tableData = filteredClaimants.map(claimant => [
        claimant.auto_id,
        `${claimant.first_name} ${claimant.last_name}`,
        claimant.contact_number || 'N/A',
        claimant.referring_attorneys?.name || 'N/A',
        new Date(claimant.created_at).toLocaleDateString()
      ]);

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY,
        ...getStyledTableOptions(),
        margin: { top: startY, left: 14, right: 14 },
      });

      // Add branded footer
      addBrandingFooter(doc);

      // Save the PDF
      doc.save(`claimants-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Export successful",
        description: `Downloaded PDF list of ${filteredClaimants.length} claimants.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export claimants list.",
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
                      <TableHead>Auto ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Number</TableHead>
                      <TableHead>Referring Attorney</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClaimants.map((claimant) => (
                      <TableRow key={claimant.id}>
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
                          {new Date(claimant.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
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
      <CompanyFooter />
    </div>
  );
};

export default ClaimantList;