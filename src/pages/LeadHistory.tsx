import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { History, Search, Filter, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SearchHistory {
  id: string;
  search_query: string;
  province: string;
  lead_type: string;
  results_found: number;
  search_date: string;
}

interface Lead {
  id: string;
  firm_name: string;
  contact_person?: string;
  province: string;
  lead_type: string;
  lead_status: string;
  priority: string;
  created_at: string;
}

const provinces = [
  "All", "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal",
  "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"
];

const leadTypes = [
  { value: "all", label: "All Types" },
  { value: "plaintiff_attorney", label: "Plaintiff Attorney (Road Accidents & Medical Negligence)" },
  { value: "defense_attorney", label: "Defense Attorney (Insurance & Corporate)" },
  { value: "state_attorney", label: "State Attorney" },
  { value: "insurance_legal_dept", label: "Insurance Company Legal Department" },
  { value: "personal_injury_firm", label: "Personal Injury Law Firm" },
  { value: "medical_malpractice_firm", label: "Medical Malpractice Specialist" },
  { value: "other", label: "Other Legal Practice" }
];

const leadStatuses = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "converted", label: "Converted" },
  { value: "not_interested", label: "Not Interested" },
  { value: "follow_up", label: "Follow Up" }
];

const LeadHistory = () => {
  const { toast } = useToast();
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("All");
  const [selectedLeadType, setSelectedLeadType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalLeads: 0,
    newLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    leadsByProvince: {} as Record<string, number>,
    leadsByType: {} as Record<string, number>
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterLeads();
    calculateAnalytics();
  }, [leads, searchTerm, selectedProvince, selectedLeadType, selectedStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch search history
      const { data: historyData, error: historyError } = await supabase
        .from('lead_search_history')
        .select('*')
        .order('search_date', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;
      setSearchHistory(historyData || []);

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.firm_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.contact_person && lead.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedProvince !== "All") {
      filtered = filtered.filter(lead => lead.province === selectedProvince);
    }

    if (selectedLeadType !== "all") {
      filtered = filtered.filter(lead => lead.lead_type === selectedLeadType);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter(lead => lead.lead_status === selectedStatus);
    }

    setFilteredLeads(filtered);
  };

  const calculateAnalytics = () => {
    const total = leads.length;
    const newLeads = leads.filter(lead => lead.lead_status === 'new').length;
    const converted = leads.filter(lead => lead.lead_status === 'converted').length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    // Group by province
    const byProvince = leads.reduce((acc, lead) => {
      acc[lead.province] = (acc[lead.province] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by type
    const byType = leads.reduce((acc, lead) => {
      const type = lead.lead_type.replace('_', ' ');
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setAnalytics({
      totalLeads: total,
      newLeads,
      convertedLeads: converted,
      conversionRate,
      leadsByProvince: byProvince,
      leadsByType: byType
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "default",
      contacted: "secondary",
      interested: "outline",
      converted: "default",
      not_interested: "destructive",
      follow_up: "secondary"
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800"
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[priority] || colors.medium}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Lead History & Analytics | Medico-Legal Assessment</title>
        <meta name="description" content="Track lead generation history, search analytics, and conversion metrics for attorney targeting campaigns." />
      </Helmet>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent">
            Attorney Lead Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Track attorney targeting performance and search history for road accident and medical negligence specialists
          </p>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Attorney Leads</p>
                <p className="text-2xl font-bold">{analytics.totalLeads}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">New Attorney Prospects</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.newLeads}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Converted Clients</p>
                <p className="text-2xl font-bold text-green-600">{analytics.convertedLeads}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-600">{analytics.conversionRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search History */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Search History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchHistory.length === 0 ? (
              <p className="text-muted-foreground">No search history available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Search Query</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Lead Type</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchHistory.map((search) => (
                    <TableRow key={search.id}>
                      <TableCell className="font-medium">{search.search_query}</TableCell>
                      <TableCell>{search.province}</TableCell>
                      <TableCell className="capitalize">{search.lead_type.replace('_', ' ')}</TableCell>
                      <TableCell>{search.results_found}</TableCell>
                      <TableCell>{format(new Date(search.search_date), 'MMM dd, yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Lead Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search firm name or contact"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="province-filter">Province</Label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="type-filter">Lead Type</Label>
                <Select value={selectedLeadType} onValueChange={setSelectedLeadType}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="status-filter">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attorney Prospects ({filteredLeads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading leads...</p>
            ) : filteredLeads.length === 0 ? (
              <p className="text-muted-foreground">No attorney leads match your current filters</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Law Firm Name</TableHead>
                    <TableHead>Primary Attorney</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.firm_name}</TableCell>
                      <TableCell>{lead.contact_person || "-"}</TableCell>
                      <TableCell>{lead.province}</TableCell>
                      <TableCell className="capitalize">{lead.lead_type.replace('_', ' ')}</TableCell>
                      <TableCell>{getStatusBadge(lead.lead_status)}</TableCell>
                      <TableCell>{getPriorityBadge(lead.priority)}</TableCell>
                      <TableCell>{format(new Date(lead.created_at), 'MMM dd, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Provincial Distribution */}
        {Object.keys(analytics.leadsByProvince).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Attorney Leads by Province
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.leadsByProvince)
                  .sort(([,a], [,b]) => b - a)
                  .map(([province, count]) => (
                    <div key={province} className="flex justify-between items-center">
                      <span className="font-medium">{province}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${(count / analytics.totalLeads) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LeadHistory;