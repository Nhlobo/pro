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
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, User, Printer, Search } from "lucide-react";
import { Link } from "react-router-dom";

interface MedicalExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  contact_number?: string;
  email?: string;
  practice_address?: string;
  consultation_fees?: number;
  court_fees?: number;
  personal_assistant_name?: string;
  personal_assistant_contact?: string;
  qualifications?: string;
  years_experience?: number;
  specializations?: string[];
  availability_notes?: string;
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
  const [experts, setExperts] = useState<MedicalExpert[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<MedicalExpert[]>([]);
  const [selectedProvince, setSelectedProvince] = useState("All Provinces");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchExperts();
  }, []);

  useEffect(() => {
    filterExperts();
  }, [experts, selectedProvince, searchTerm]);

  const fetchExperts = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_experts')
        .select('*')
        .order('province', { ascending: true })
        .order('last_name', { ascending: true });

      if (error) throw error;
      setExperts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load medical experts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterExperts = () => {
    let filtered = experts;

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

    setFilteredExperts(filtered);
  };

  const handlePrint = () => {
    const printTitle = selectedProvince === "All Provinces" 
      ? "Medical Experts Directory - National" 
      : `Medical Experts Directory - ${selectedProvince}`;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .expert-card { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
            .expert-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 5px; }
            .expert-type { color: #666; font-size: 14px; margin-bottom: 10px; }
            .contact-info { margin: 10px 0; }
            .contact-item { margin: 5px 0; }
            .fees { background: #f5f5f5; padding: 10px; margin: 10px 0; }
            .specializations { margin: 10px 0; }
            .badge { background: #e0e0e0; padding: 2px 8px; margin: 2px; border-radius: 12px; font-size: 12px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${printTitle}</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
            <p>Total Experts: ${filteredExperts.length}</p>
          </div>
          ${filteredExperts.map(expert => `
            <div class="expert-card">
              <div class="expert-name">Dr. ${expert.first_name} ${expert.last_name}</div>
              <div class="expert-type">${expert.expert_type} • ${expert.province}</div>
              
              <div class="contact-info">
                ${expert.contact_number ? `<div class="contact-item">📞 ${expert.contact_number}</div>` : ''}
                ${expert.email ? `<div class="contact-item">✉️ ${expert.email}</div>` : ''}
                ${expert.practice_address ? `<div class="contact-item">📍 ${expert.practice_address}</div>` : ''}
              </div>
              
              ${expert.qualifications ? `<div><strong>Qualifications:</strong> ${expert.qualifications}</div>` : ''}
              ${expert.years_experience ? `<div><strong>Experience:</strong> ${expert.years_experience} years</div>` : ''}
              
              ${expert.specializations && expert.specializations.length > 0 ? `
                <div class="specializations">
                  <strong>Specializations:</strong> ${expert.specializations.join(', ')}
                </div>
              ` : ''}
              
              <div class="fees">
                ${expert.consultation_fees ? `<div><strong>Consultation Fee:</strong> R${expert.consultation_fees}</div>` : ''}
                ${expert.court_fees ? `<div><strong>Court Fee:</strong> R${expert.court_fees}</div>` : ''}
              </div>
              
              ${expert.personal_assistant_name || expert.personal_assistant_contact ? `
                <div>
                  <strong>Personal Assistant:</strong> 
                  ${expert.personal_assistant_name || ''} 
                  ${expert.personal_assistant_contact ? `(${expert.personal_assistant_contact})` : ''}
                </div>
              ` : ''}
              
              ${expert.availability_notes ? `<div><strong>Notes:</strong> ${expert.availability_notes}</div>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
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
              
              <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print Directory
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {filteredExperts.length} expert(s)</span>
              {selectedProvince !== "All Provinces" && (
                <Badge variant="secondary">{selectedProvince}</Badge>
              )}
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
              <Card key={expert.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        Dr. {expert.first_name} {expert.last_name}
                      </CardTitle>
                      <CardDescription className="text-base font-medium">
                        {expert.expert_type} • {expert.province}
                      </CardDescription>
                    </div>
                    
                    {expert.years_experience && (
                      <Badge variant="outline">
                        {expert.years_experience} years experience
                      </Badge>
                    )}
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
                      {expert.contact_number && (
                        <p className="text-sm">📞 {expert.contact_number}</p>
                      )}
                      {expert.email && (
                        <p className="text-sm">✉️ {expert.email}</p>
                      )}
                      {expert.practice_address && (
                        <p className="text-sm flex items-start gap-1">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {expert.practice_address}
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
                  {(expert.personal_assistant_name || expert.personal_assistant_contact) && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Personal Assistant
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {expert.personal_assistant_name}
                          {expert.personal_assistant_contact && (
                            <> • {expert.personal_assistant_contact}</>
                          )}
                        </p>
                      </div>
                    </>
                  )}
                  
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
    </div>
  );
};

export default MedicalExpertDirectory;