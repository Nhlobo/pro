import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { ArrowLeft, Phone, Mail, MapPin, User, Download, Search, FileText, Calendar, BarChart3, Edit, Shield, RefreshCw, Trash2, AlertCircle, GitMerge } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import { SecureDataDisplay } from "@/components/SecureDataDisplay";
import { useSecureMedicalExperts } from "@/hooks/useSecureMedicalExperts";
import PermissionGuard from "@/components/PermissionGuard";
import MergeExpertDialog from "@/components/MergeExpertDialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { formatExpertType } from "@/utils/expertTypeMapping";

interface MedicalExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  email_masked?: string;
  phone_masked?: string;
  address_masked?: string;
  pa_name_masked?: string;
  pa_phone_masked?: string;
  consultation_fees?: number;
  court_fees?: number;
  qualifications?: string;
  years_experience?: number;
  specializations?: string[];
  availability_notes?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  cv_document_url?: string | null;
  matter_types?: string[] | null;
  booking_stats?: {
    quarterly_bookings: number;
    yearly_bookings: number;
    has_bookings: boolean;
  };
}

const provinces = [
  "All Provinces",
  "Eastern Cape",
  "Free State", 
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape"
];

const MedicalExpertDirectory = () => {
  const [filteredExperts, setFilteredExperts] = useState<MedicalExpert[]>([]);
  const [selectedProvince, setSelectedProvince] = useState("All Provinces");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showRecentlyAdded, setShowRecentlyAdded] = useState(false);
  const [clearingExperts, setClearingExperts] = useState(false);
  const [selectedExperts, setSelectedExperts] = useState<Set<string>>(new Set());
  const [matterTypeFilter, setMatterTypeFilter] = useState<string>("all");
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { experts, loading, error, refetch } = useSecureMedicalExperts();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Remove fetchExperts useEffect as it's handled by the hook

  useEffect(() => {
    filterExperts();
  }, [experts, selectedProvince, searchTerm, showInactive, showRecentlyAdded]);

  // Add booking stats to secure experts data
  const expertsWithBookingStats = async (secureExperts: any[]) => {
    try {
      const now = new Date();
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      
      const expertIds = secureExperts.map(e => e.id);
      let quarterMap: Record<string, number> = {};
      let yearMap: Record<string, number> = {};

      if (expertIds.length > 0) {
        const [qRes, yRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('expert_id, appointment_date')
            .in('expert_id', expertIds)
            .gte('appointment_date', quarterStart.toISOString()),
          supabase
            .from('appointments')
            .select('expert_id, appointment_date')
            .in('expert_id', expertIds)
            .gte('appointment_date', yearStart.toISOString()),
        ]);

        if (!qRes.error && qRes.data) {
          for (const row of qRes.data as any[]) {
            quarterMap[row.expert_id] = (quarterMap[row.expert_id] || 0) + 1;
          }
        }
        if (!yRes.error && yRes.data) {
          for (const row of yRes.data as any[]) {
            yearMap[row.expert_id] = (yearMap[row.expert_id] || 0) + 1;
          }
        }
      }

      return secureExperts.map((expert: any) => ({
        ...expert,
        booking_stats: {
          quarterly_bookings: quarterMap[expert.id] || 0,
          yearly_bookings: yearMap[expert.id] || 0,
          has_bookings: (yearMap[expert.id] || 0) > 0,
        },
      }));
    } catch (error) {
      console.error('Error fetching booking stats:', error);
      return secureExperts.map((expert: any) => ({
        ...expert,
        booking_stats: {
          quarterly_bookings: 0,
          yearly_bookings: 0,
          has_bookings: false,
        },
      }));
    }
  };

  // Process experts with booking stats when they're loaded
  useEffect(() => {
    if (experts.length > 0) {
      expertsWithBookingStats(experts).then(setFilteredExperts);  
    }
  }, [experts]);

  const filterExperts = () => {
    if (!experts.length) return;
    let filtered = experts;

    // Filter by status (show inactive only if requested)
    if (!showInactive) {
      filtered = filtered.filter(expert => expert.status !== 'inactive');
    }

    // Filter by recently added (last 30 days)
    if (showRecentlyAdded) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(expert => 
        new Date(expert.created_at) >= thirtyDaysAgo
      );
    }

    if (selectedProvince !== "All Provinces") {
      filtered = filtered.filter(expert => expert.province === selectedProvince);
    }

    if (searchTerm) {
      filtered = filtered.filter(expert => 
        expert.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expert.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expert.expert_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expert.specializations?.some(spec => 
          spec.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    expertsWithBookingStats(filtered).then(setFilteredExperts);
  };

  const handleDownloadPDF = async () => {
    try {
      const doc = new jsPDF();
      const reportTitle = selectedProvince === "All Provinces" 
        ? "Medical Experts Directory - National" 
        : `Medical Experts Directory - ${selectedProvince}`;
      const subtitle = `Total Experts: ${filteredExperts.length}`;

      // Add company branding to PDF
      let currentY = addBrandingToPDF(doc, reportTitle, subtitle);
      currentY += 10;

      if (filteredExperts.length === 0) {
        doc.setFontSize(12);
        doc.text('No medical experts found matching your criteria.', 20, currentY);
      } else {
        // Prepare data for the table
        const tableData = filteredExperts.map((expert) => [
          `Dr. ${expert.first_name} ${expert.last_name}`,
          formatExpertType(expert.expert_type),
          expert.province,
          expert.years_experience ? `${expert.years_experience} years` : 'N/A',
          expert.specializations ? expert.specializations.slice(0, 2).join(', ') + (expert.specializations.length > 2 ? '...' : '') : 'N/A',
          expert.phone_masked || 'Private',
          expert.email_masked || 'Private',
          expert.consultation_fees ? `R${expert.consultation_fees}` : 'N/A',
          expert.court_fees ? `R${expert.court_fees}` : 'N/A',
          expert.booking_stats?.yearly_bookings || 0
        ]);

        const headers = [
          'Expert Name', 
          'Type', 
          'Province', 
          'Experience', 
          'Specializations',
          'Phone',
          'Email', 
          'Consultation Fee',
          'Court Fee',
          'Yearly Bookings'
        ];

        // Add table with company styling
        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: currentY,
          ...getStyledTableOptions(),
          columnStyles: {
            0: { cellWidth: 25 }, // Expert name
            1: { cellWidth: 20 }, // Type
            2: { cellWidth: 18 }, // Province
            3: { cellWidth: 15 }, // Experience
            4: { cellWidth: 25 }, // Specializations
            5: { cellWidth: 20 }, // Phone
            6: { cellWidth: 25 }, // Email
            7: { cellWidth: 18 }, // Consultation Fee
            8: { cellWidth: 15 }, // Court Fee
            9: { cellWidth: 15 }  // Bookings
          },
          margin: { left: 10, right: 10 },
        });

        // Add detailed information for each expert on subsequent pages if needed
        if (filteredExperts.length <= 10) { // Only add details for smaller lists
          let detailsY = (doc as any).lastAutoTable.finalY + 20;
          
          doc.addPage();
          currentY = addBrandingToPDF(doc, "Detailed Expert Information", "Complete contact and qualification details");
          currentY += 10;

          filteredExperts.forEach((expert, index) => {
            if (currentY > 250) { // Add new page if needed
              doc.addPage();
              currentY = addBrandingToPDF(doc, "Detailed Expert Information (Continued)", "");
              currentY += 10;
            }

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`${index + 1}. Dr. ${expert.first_name} ${expert.last_name}`, 20, currentY);
            currentY += 8;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            
            const details = [
              `Type: ${formatExpertType(expert.expert_type)}`,
              `Province: ${expert.province}`,
              expert.qualifications ? `Qualifications: ${expert.qualifications}` : null,
              expert.years_experience ? `Experience: ${expert.years_experience} years` : null,
              expert.address_masked ? `Address: ${expert.address_masked}` : null,
              expert.pa_name_masked ? `PA: ${expert.pa_name_masked}${expert.pa_phone_masked ? ` (${expert.pa_phone_masked})` : ''}` : null,
              expert.availability_notes ? `Notes: ${expert.availability_notes}` : null
            ].filter(Boolean);

            details.forEach(detail => {
              if (detail) {
                doc.text(detail, 25, currentY);
                currentY += 6;
              }
            });

            currentY += 5; // Space between experts
          });
        }
      }

      // Add footer branding
      addBrandingFooter(doc);

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = selectedProvince === "All Provinces" 
        ? `Medical_Experts_Directory_National_${timestamp}.pdf`
        : `Medical_Experts_Directory_${selectedProvince.replace(/\s+/g, '_')}_${timestamp}.pdf`;

      // Save the PDF
      doc.save(filename);

      toast({
        title: "Download Complete",
        description: `Medical experts directory has been downloaded as ${filename}`,
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF report.",
        variant: "destructive",
      });
    }
  };

  const handleEditExpert = (expert: MedicalExpert) => {
    // Navigate to edit form with expert ID
    window.location.href = `/medical-expert?edit=${expert.id}`;
  };

  const handleClearAllExperts = async () => {
    const ok = await confirm({
      title: 'Delete all experts?',
      description: 'Are you sure you want to delete ALL medical experts? This action cannot be undone.',
      confirmText: 'Delete all',
      destructive: true,
    });
    if (!ok) return;

    setClearingExperts(true);
    try {
      const { data, error } = await supabase.rpc('clear_medical_experts');
      
      if (error) throw error;

      toast({
        title: "Experts Cleared Successfully",
        description: `${data || 0} medical experts have been removed from the directory.`,
      });

      // Refresh the experts list
      refetch();
      
    } catch (error) {
      console.error('Error clearing experts:', error);
      toast({
        title: "Clear Failed",
        description: "There was an error clearing the medical experts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingExperts(false);
    }
  };

  const handleClearProvince = async () => {
    if (selectedProvince === "All Provinces") {
      toast({
        title: "Select a Province",
        description: "Please select a specific province to clear experts from.",
        variant: "destructive",
      });
      return;
    }

    const ok = await confirm({
      title: `Delete experts in ${selectedProvince}?`,
      description: `Are you sure you want to delete ALL medical experts from ${selectedProvince}? This action cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setClearingExperts(true);
    try {
      const { data, error } = await supabase.rpc('clear_medical_experts_by_province', {
        p_province: selectedProvince
      });
      
      if (error) throw error;

      toast({
        title: "Province Experts Cleared Successfully",
        description: `${data || 0} medical experts have been removed from ${selectedProvince}.`,
      });

      // Refresh the experts list
      refetch();
      
    } catch (error) {
      console.error('Error clearing province experts:', error);
      toast({
        title: "Clear Failed",
        description: "There was an error clearing the medical experts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingExperts(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    const ok = await confirm({
      title: 'Remove duplicates?',
      description: 'Are you sure you want to remove duplicate medical experts? This will keep only the oldest record for each duplicate set.',
      confirmText: 'Remove duplicates',
    });
    if (!ok) return;

    setClearingExperts(true);
    try {
      const { data, error } = await supabase.rpc('remove_duplicate_medical_experts');
      
      if (error) throw error;

      const result = data as Array<{ duplicates_removed: number; kept_experts: number }>;
      
      if (result && result.length > 0) {
        const { duplicates_removed, kept_experts } = result[0];
        
        if (duplicates_removed === 0) {
          toast({
            title: "No Duplicates Found",
            description: "All medical experts in the directory are unique.",
          });
        } else {
          toast({
            title: "Duplicates Removed Successfully",
            description: `Removed ${duplicates_removed} duplicate expert(s). Kept ${kept_experts} unique expert(s).`,
          });
        }
      }

      // Refresh the experts list
      refetch();
      
    } catch (error) {
      console.error('Error removing duplicates:', error);
      toast({
        title: "Remove Duplicates Failed",
        description: "There was an error removing duplicate experts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingExperts(false);
    }
  };

  const handleSelectExpert = (expertId: string, checked: boolean) => {
    const newSelected = new Set(selectedExperts);
    if (checked) {
      newSelected.add(expertId);
    } else {
      newSelected.delete(expertId);
    }
    setSelectedExperts(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Apply matter type filter when selecting all
      const expertsToSelect = filteredExperts.filter(expert => {
        if (matterTypeFilter === "all") return true;
        return expert.matter_types?.includes(matterTypeFilter);
      });
      setSelectedExperts(new Set(expertsToSelect.map(e => e.id)));
    } else {
      setSelectedExperts(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedExperts.size === 0) {
      toast({
        title: "No Experts Selected",
        description: "Please select at least one expert to delete.",
        variant: "destructive",
      });
      return;
    }

    const matterTypeText = matterTypeFilter === "all" ? "all matter types" : matterTypeFilter;
    const ok = await confirm({
      title: 'Delete selected experts?',
      description: `Are you sure you want to delete ${selectedExperts.size} selected expert(s)${matterTypeFilter !== "all" ? ` with matter type ${matterTypeText}` : ""}? This action cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setClearingExperts(true);
    try {
      const { error } = await supabase
        .from('medical_experts')
        .delete()
        .in('id', Array.from(selectedExperts));

      if (error) throw error;

      toast({
        title: "Experts Deleted Successfully",
        description: `${selectedExperts.size} expert(s) have been deleted from the directory.`,
      });

      setSelectedExperts(new Set());
      refetch();
      
    } catch (error) {
      console.error('Error deleting experts:', error);
      toast({
        title: "Delete Failed",
        description: "There was an error deleting the selected experts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingExperts(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading medical experts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Medical Expert Directory - Professional Medical Experts</title>
        <meta 
          name="description" 
          content="Comprehensive directory of medical experts by province. Find qualified medical professionals with contact details, fees, and specializations." 
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Medical Expert Directory</h1>
              <p className="text-muted-foreground">
                Find qualified medical experts by province with complete contact information
              </p>
            </div>
            <PermissionGuard permission={["admin", "employee"]}>
              <Link to="/medical-expert-form">
                <Button className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Add New Expert
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Internal Controls & Search
            </CardTitle>
            <CardDescription>
              Administrative access to expert management and filtering capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, type, or specialization..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                <SelectTrigger className="md:w-48">
                  <SelectValue placeholder="Select Province" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={matterTypeFilter} onValueChange={setMatterTypeFilter}>
                <SelectTrigger className="md:w-40">
                  <SelectValue placeholder="Matter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="MVA">MVA</SelectItem>
                  <SelectItem value="Med Neg">Med Neg</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={refetch} 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              
              <PermissionGuard permission={["admin"]}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="flex items-center gap-2"
                      disabled={clearingExperts || loading}
                    >
                      <Trash2 className={`h-4 w-4 ${clearingExperts ? 'animate-spin' : ''}`} />
                      {clearingExperts ? 'Processing...' : 'Delete Actions'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleClearProvince}
                      disabled={clearingExperts || loading || selectedProvince === "All Provinces"}
                      className="cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Province
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowMergeDialog(true)}
                      disabled={clearingExperts || loading}
                      className="cursor-pointer"
                    >
                      <GitMerge className="h-4 w-4 mr-2" />
                      Manage Duplicates (Merge & Delete)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleRemoveDuplicates}
                      disabled={clearingExperts || loading}
                      className="cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Auto-Remove Duplicates
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeleteSelected}
                      disabled={clearingExperts || loading || selectedExperts.size === 0}
                      className="cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedExperts.size})
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleClearAllExperts}
                      disabled={clearingExperts || loading}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>
              
              <Link to="/expert-reports">
                <Button variant="secondary" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Expert Reports
                </Button>
              </Link>
              
              <Link to="/report-tracking">
                <Button variant="default" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Report Tracking
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {filteredExperts.filter(e => matterTypeFilter === "all" || e.matter_types?.includes(matterTypeFilter)).length} expert(s)</span>
                {selectedProvince !== "All Provinces" && (
                  <Badge variant="secondary">{selectedProvince}</Badge>
                )}
                {matterTypeFilter !== "all" && (
                  <Badge variant="default">{matterTypeFilter}</Badge>
                )}
                {showRecentlyAdded && (
                  <Badge variant="default">Recently Added (30 days)</Badge>
                )}
                {selectedExperts.size > 0 && (
                  <Badge variant="destructive">{selectedExperts.size} selected</Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-inactive" 
                    checked={showInactive}
                    onCheckedChange={(checked) => setShowInactive(checked === true)}
                  />
                  <label 
                    htmlFor="show-inactive" 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Show inactive experts
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-recently-added" 
                    checked={showRecentlyAdded}
                    onCheckedChange={(checked) => setShowRecentlyAdded(checked === true)}
                  />
                  <label 
                    htmlFor="show-recently-added" 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Recently added (30 days)
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {filteredExperts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No medical experts found matching your criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <PermissionGuard permission={["admin", "employee"]}>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedExperts.size > 0 && selectedExperts.size === filteredExperts.filter(e => matterTypeFilter === "all" || e.matter_types?.includes(matterTypeFilter)).length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                      </PermissionGuard>
                      <TableHead>Expert Name</TableHead>
                      <TableHead>Type of Expert</TableHead>
                      <TableHead>Province</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Specialization Area</TableHead>
                      <TableHead>Expert Fees</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExperts
                      .filter(expert => matterTypeFilter === "all" || expert.matter_types?.includes(matterTypeFilter))
                      .map((expert) => {
                        const matters = expert.matter_types || [];
                        const hasMVA = matters.includes('MVA');
                        const hasMedNeg = matters.includes('Med Neg');
                        const isBoth = hasMVA && hasMedNeg;
                        return (
                      <TableRow 
                        key={expert.id} 
                        className={expert.status === 'inactive' ? 'opacity-60' : ''}
                      >
                        <PermissionGuard permission={["admin", "employee"]}>
                          <TableCell>
                            <Checkbox
                              checked={selectedExperts.has(expert.id)}
                              onCheckedChange={(checked) => handleSelectExpert(expert.id, checked === true)}
                            />
                          </TableCell>
                        </PermissionGuard>
                        <TableCell className="font-medium">
                          Dr. {expert.first_name} {expert.last_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatExpertType(expert.expert_type)}</Badge>
                        </TableCell>
                        <TableCell>{expert.province}</TableCell>
                        <TableCell>
                          {expert.years_experience ? `${expert.years_experience} years` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {expert.phone_masked}<br/>
                          {expert.email_masked}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isBoth ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Both (MVA & Med Neg)</Badge>
                            ) : hasMVA ? (
                              <Badge className="bg-blue-600 hover:bg-blue-600 text-white">MVA</Badge>
                            ) : hasMedNeg ? (
                              <Badge className="bg-purple-600 hover:bg-purple-600 text-white">Med Neg</Badge>
                            ) : (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Not specified
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs min-w-[160px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Consultation:</span>
                              {expert.consultation_fees ? (
                                <span className="font-semibold">R{expert.consultation_fees.toLocaleString()}</span>
                              ) : (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Missing
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Court:</span>
                              {expert.court_fees ? (
                                <span className="font-semibold">R{expert.court_fees.toLocaleString()}</span>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {expert.updated_at ? new Date(expert.updated_at).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <PermissionGuard permission={["admin", "employee"]}>
                            <div className="flex items-center justify-end gap-2">
                              <Link to={`/medical-expert-form/${expert.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm('Delete this expert?')) {
                                    const { error } = await supabase
                                      .from('medical_experts')
                                      .delete()
                                      .eq('id', expert.id);
                                    if (!error) {
                                      toast({ title: 'Expert deleted' });
                                      refetch();
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </PermissionGuard>
                        </TableCell>
                        </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <MergeExpertDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          onMergeComplete={refetch}
        />
      </main>
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertDirectory;