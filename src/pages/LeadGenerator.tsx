import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Search, Plus, ExternalLink, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Lead {
  id: string;
  firm_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  province: string;
  lead_type: string;
  practice_areas?: string[];
  lead_status: string;
  priority: string;
  notes?: string;
  created_at: string;
}

const provinces = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal",
  "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"
];

const leadTypes = [
  { value: "plaintiff_attorney", label: "Plaintiff Attorney" },
  { value: "state_attorney", label: "State Attorney" },
  { value: "insurance_claimant_dept", label: "Insurance Claimant Department" },
  { value: "prasa_matters", label: "PRASA Matters" },
  { value: "other", label: "Other" }
];

const LeadGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Search form state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedLeadType, setSelectedLeadType] = useState("");
  
  // Manual lead form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLead, setManualLead] = useState({
    firm_name: "",
    contact_person: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    province: "",
    lead_type: "",
    practice_areas: "",
    notes: "",
    priority: "medium"
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSearch = async () => {
    if (!searchQuery || !selectedProvince || !selectedLeadType) {
      toast({
        title: "Missing Information",
        description: "Please fill in search query, province, and lead type",
        variant: "destructive",
      });
      return;
    }

    setSearchLoading(true);
    try {
      // This would integrate with Google Custom Search API
      // For now, we'll create a search history entry
      const { error: historyError } = await supabase
        .from('lead_search_history')
        .insert({
          search_query: searchQuery,
          province: selectedProvince,
          lead_type: selectedLeadType,
          results_found: 0,
          created_by: user?.id
        });

      if (historyError) throw historyError;

      toast({
        title: "Search Initiated",
        description: "Google search API integration needed. This will find attorney firms matching your criteria.",
      });
    } catch (error) {
      console.error('Error creating search history:', error);
      toast({
        title: "Error",
        description: "Failed to initiate search",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleManualLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLead.firm_name || !manualLead.province || !manualLead.lead_type) {
      toast({
        title: "Missing Information",
        description: "Please fill in firm name, province, and lead type",
        variant: "destructive",
      });
      return;
    }

    try {
      const practiceAreasArray = manualLead.practice_areas
        ? manualLead.practice_areas.split(',').map(area => area.trim())
        : [];

      const { error } = await supabase
        .from('leads')
        .insert({
          ...manualLead,
          practice_areas: practiceAreasArray,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead added successfully",
      });

      setManualLead({
        firm_name: "",
        contact_person: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        province: "",
        lead_type: "",
        practice_areas: "",
        notes: "",
        priority: "medium"
      });
      setShowManualForm(false);
      fetchLeads();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Lead Generator - Target Attorney Market | Medico-Legal Assessment</title>
        <meta name="description" content="Generate and manage leads for plaintiff attorneys, state attorneys, insurance departments, and PRASA matters across South African provinces." />
      </Helmet>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent">
            Lead Generator
          </h1>
          <p className="text-muted-foreground mt-2">
            Target plaintiff attorneys, state attorneys, insurance claimant departments, and PRASA matters
          </p>
        </div>

        {/* Google Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Google Search Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search-query">Search Query</Label>
                <Input
                  id="search-query"
                  placeholder="e.g., personal injury lawyers"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="province">Province</Label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lead-type">Lead Type</Label>
                <Select value={selectedLeadType} onValueChange={setSelectedLeadType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGoogleSearch} disabled={searchLoading} className="w-full md:w-auto">
              {searchLoading ? "Searching..." : "Search Google"}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Lead Entry */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Manual Lead Entry
              </span>
              <Button
                variant="outline"
                onClick={() => setShowManualForm(!showManualForm)}
              >
                {showManualForm ? "Cancel" : "Add Manual Lead"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showManualForm && (
            <CardContent>
              <form onSubmit={handleManualLeadSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firm-name">Firm Name *</Label>
                    <Input
                      id="firm-name"
                      value={manualLead.firm_name}
                      onChange={(e) => setManualLead({ ...manualLead, firm_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-person">Contact Person</Label>
                    <Input
                      id="contact-person"
                      value={manualLead.contact_person}
                      onChange={(e) => setManualLead({ ...manualLead, contact_person: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={manualLead.email}
                      onChange={(e) => setManualLead({ ...manualLead, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={manualLead.phone}
                      onChange={(e) => setManualLead({ ...manualLead, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={manualLead.website}
                      onChange={(e) => setManualLead({ ...manualLead, website: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={manualLead.address}
                      onChange={(e) => setManualLead({ ...manualLead, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-province">Province *</Label>
                    <Select value={manualLead.province} onValueChange={(value) => setManualLead({ ...manualLead, province: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="manual-lead-type">Lead Type *</Label>
                    <Select value={manualLead.lead_type} onValueChange={(value) => setManualLead({ ...manualLead, lead_type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lead type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leadTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="practice-areas">Practice Areas (comma-separated)</Label>
                    <Input
                      id="practice-areas"
                      placeholder="Personal Injury, Motor Vehicle Accidents"
                      value={manualLead.practice_areas}
                      onChange={(e) => setManualLead({ ...manualLead, practice_areas: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={manualLead.priority} onValueChange={(value) => setManualLead({ ...manualLead, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional information about this lead"
                    value={manualLead.notes}
                    onChange={(e) => setManualLead({ ...manualLead, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full md:w-auto">
                  Add Lead
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Leads List */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading leads...</p>
            ) : leads.length === 0 ? (
              <p className="text-muted-foreground">No leads found. Start by searching or adding manual leads.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leads.map((lead) => (
                  <Card key={lead.id} className="border-l-4 border-l-primary/50">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-lg">{lead.firm_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            lead.priority === 'high' ? 'bg-red-100 text-red-800' :
                            lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {lead.priority.toUpperCase()}
                          </span>
                        </div>
                        
                        {lead.contact_person && (
                          <p className="text-sm font-medium">{lead.contact_person}</p>
                        )}
                        
                        <div className="space-y-1">
                          {lead.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </div>
                          )}
                          {lead.address && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {lead.address}
                            </div>
                          )}
                          {lead.website && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ExternalLink className="h-3 w-3" />
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-3 w-3" />
                            <span className="font-medium">{lead.province}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="capitalize">{lead.lead_type.replace('_', ' ')}</span>
                          </div>
                          
                          {lead.practice_areas && lead.practice_areas.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground">Practice Areas:</p>
                              <p className="text-sm">{lead.practice_areas.join(', ')}</p>
                            </div>
                          )}
                          
                          {lead.notes && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground">Notes:</p>
                              <p className="text-sm">{lead.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            lead.lead_status === 'converted' ? 'bg-green-100 text-green-800' :
                            lead.lead_status === 'interested' ? 'bg-blue-100 text-blue-800' :
                            lead.lead_status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lead.lead_status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeadGenerator;