import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, TrendingUp, Target, UserCheck, UserX, Plus } from "lucide-react";
import { useAttorneys, Attorney } from "@/hooks/useAttorneys";
import { useNavigate } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import { Helmet } from "react-helmet-async";

const CRMDashboard = () => {
  const navigate = useNavigate();
  const { attorneys, loading, fetchAttorneys, getAttorneyStats } = useAttorneys();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadStats = async () => {
      const statsData = await getAttorneyStats();
      setStats(statsData);
    };
    loadStats();
  }, [attorneys]);

  const handleSearch = () => {
    fetchAttorneys({
      name: searchTerm || undefined,
      location: locationFilter || undefined,
      specialization: specializationFilter && specializationFilter !== "all" ? specializationFilter : undefined,
      status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'potential': return 'outline';
      case 'pitched': return 'secondary';
      case 'interested': return 'default';
      case 'closed': return 'default';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'potential': return <Users className="h-4 w-4" />;
      case 'pitched': return <Target className="h-4 w-4" />;
      case 'interested': return <UserCheck className="h-4 w-4" />;
      case 'closed': return <TrendingUp className="h-4 w-4" />;
      default: return <UserX className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>CRM Dashboard - Medico-Legal Attorney Management</title>
        <meta name="description" content="Manage attorney relationships, track pitches, and monitor lead conversion rates in your medico-legal CRM system." />
      </Helmet>

      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
              <p className="text-muted-foreground mt-1">Medico-Legal Attorney Management</p>
            </div>
            <Button onClick={() => navigate('/crm/attorney/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Attorney
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Attorneys</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.potential}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pitched Leads</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pitched}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Interested Leads</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.interested}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Closed Leads</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.closed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Attorney Search Engine
            </CardTitle>
            <CardDescription>
              Search attorneys by name, location, and specialization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <Input
                placeholder="Filter by location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />

              <Select value={specializationFilter} onValueChange={setSpecializationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Specialization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specializations</SelectItem>
                  <SelectItem value="medico-legal">Medico-Legal</SelectItem>
                  <SelectItem value="RAF">RAF</SelectItem>
                  <SelectItem value="negligence">Negligence</SelectItem>
                  <SelectItem value="personal-injury">Personal Injury</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="pitched">Pitched</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleSearch} className="w-full">
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attorney Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">Loading attorneys...</p>
            </div>
          ) : attorneys.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">No attorneys found. Try adjusting your search criteria.</p>
            </div>
          ) : (
            attorneys.map((attorney: Attorney) => (
              <Card 
                key={attorney.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/crm/attorney/${attorney.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{attorney.name}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(attorney.status)} className="gap-1">
                      {getStatusIcon(attorney.status)}
                      {attorney.status.charAt(0).toUpperCase() + attorney.status.slice(1)}
                    </Badge>
                  </div>
                  {attorney.law_firm && (
                    <CardDescription>{attorney.law_firm}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {attorney.location && (
                      <p className="text-sm text-muted-foreground">📍 {attorney.location}</p>
                    )}
                    {attorney.specialization && attorney.specialization.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {attorney.specialization.map((spec, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {attorney.email && (
                      <p className="text-sm text-muted-foreground">✉️ {attorney.email}</p>
                    )}
                    {attorney.phone && (
                      <p className="text-sm text-muted-foreground">📞 {attorney.phone}</p>
                    )}
                  </div>
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

export default CRMDashboard;