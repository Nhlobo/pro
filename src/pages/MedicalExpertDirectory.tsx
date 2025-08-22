import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, User, Download, Search, FileText, Calendar, BarChart3, Edit, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import { SecureDataDisplay } from "@/components/SecureDataDisplay";
import { useSecureMedicalExperts } from "@/hooks/useSecureMedicalExperts";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";

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
  const { experts, loading, error } = useSecureMedicalExperts();
  const { toast } = useToast();

  // Remove fetchExperts useEffect as it's handled by the hook

  useEffect(() => {
    filterExperts();
  }, [experts, selectedProvince, searchTerm, showInactive]);

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
          expert.expert_type,
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
              `Type: ${expert.expert_type}`,
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
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Medical Expert Directory</h1>
          <p className="text-muted-foreground">
            Find qualified medical experts by province with complete contact information
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>
              Filter experts by province or search by name, type, or specialization
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
                <SelectTrigger className="md:w-64">
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
              
              <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              
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
                <span>Showing {filteredExperts.length} expert(s)</span>
                {selectedProvince !== "All Provinces" && (
                  <Badge variant="secondary">{selectedProvince}</Badge>
                )}
              </div>
              
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
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {filteredExperts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No medical experts found matching your criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredExperts.map((expert) => (
              <Card key={expert.id} className={`overflow-hidden ${expert.status === 'inactive' ? 'opacity-60 border-muted' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                     <div>
                       <CardTitle className="text-xl flex items-center gap-2">
                         Dr. {expert.first_name} {expert.last_name}
                         {expert.status === 'inactive' && (
                           <Badge variant="destructive" className="text-xs">Inactive</Badge>
                         )}
                       </CardTitle>
                       <CardDescription className="text-base font-medium">
                         {expert.expert_type} • {expert.province}
                       </CardDescription>
                     </div>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleEditExpert(expert)}
                       className="flex items-center gap-2"
                     >
                       <Edit className="h-4 w-4" />
                       Edit
                     </Button>
                    
                    <div className="flex gap-2 flex-wrap justify-end">
                      {expert.years_experience && (
                        <Badge variant="outline">
                          {expert.years_experience} years experience
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Booking Statistics */}
                  <div className="flex gap-4 mt-3 p-3 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <BarChart3 className="h-3 w-3" />
                        Quarterly
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {expert.booking_stats?.quarterly_bookings || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        Yearly
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {expert.booking_stats?.yearly_bookings || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">Status</div>
                      <Badge variant={expert.booking_stats?.has_bookings ? "default" : "secondary"} className="text-xs">
                        {expert.booking_stats?.has_bookings ? "Booked" : "Available"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                   {/* Contact Information */}
                   <div className="grid md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <h4 className="font-semibold flex items-center gap-2">
                         <Phone className="h-4 w-4" />
                         Contact Information
                       </h4>
                        {expert.phone_masked ? (
                          <p className="text-sm">📞 {expert.phone_masked}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">📞 Contact details available to law firms with active appointments</p>
                        )}
                        {expert.email_masked ? (
                          <p className="text-sm">✉️ {expert.email_masked}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">✉️ Email available to law firms with active appointments</p>
                        )}
                        {expert.address_masked ? (
                          <p className="text-sm flex items-start gap-1">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {expert.address_masked}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            Address available to law firms with active appointments
                          </p>
                        )}
                     </div>
                    
                    {/* Fees */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Fees
                      </h4>
                      {expert.consultation_fees && (
                        <p className="text-sm">Consultation: R{expert.consultation_fees}</p>
                      )}
                      {expert.court_fees && (
                        <p className="text-sm">Court Appearance: R{expert.court_fees}</p>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Qualifications and Specializations */}
                  <div className="space-y-3">
                    {expert.qualifications && (
                      <div>
                        <h4 className="font-semibold text-sm">Qualifications</h4>
                        <p className="text-sm text-muted-foreground">{expert.qualifications}</p>
                      </div>
                    )}
                    
                    {expert.specializations && expert.specializations.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Specializations</h4>
                        <div className="flex flex-wrap gap-1">
                          {expert.specializations.map((spec, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                   {/* Personal Assistant */}
                   <>
                     <Separator />
                     <div>
                       <h4 className="font-semibold text-sm flex items-center gap-2">
                         <User className="h-4 w-4" />
                         Personal Assistant
                       </h4>
                        {expert.pa_name_masked || expert.pa_phone_masked ? (
                          <p className="text-sm text-muted-foreground">
                            {expert.pa_name_masked}
                            {expert.pa_phone_masked && (
                              <> • {expert.pa_phone_masked}</>
                            )}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Personal assistant contact available to law firms with active appointments
                          </p>
                        )}
                     </div>
                   </>
                  
                  {/* Availability Notes */}
                  {expert.availability_notes && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-sm">Availability Notes</h4>
                        <p className="text-sm text-muted-foreground">{expert.availability_notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertDirectory;