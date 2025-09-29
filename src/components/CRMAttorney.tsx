import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAttorneySearch, type AttorneyResult } from "@/hooks/useAttorneySearch";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Users, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin,
  Star,
  Filter,
  Plus,
  Contact
} from "lucide-react";

const provinces = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", 
  "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape"
];

const practiceAreas = [
  "RAF", "Assault", "Medical Negligence", "Personal Injury", 
  "Criminal Law", "Civil Litigation", "Commercial Law"
];

const roles = ["Plaintiff", "Defence", "State", "General Practice"];

export const CRMAttorney: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedPracticeAreas, setSelectedPracticeAreas] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("search");
  
  const { 
    results, 
    governmentInstitutions, 
    loading, 
    error, 
    searchAttorneys, 
    clearResults 
  } = useAttorneySearch();
  
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim() && !selectedProvince && selectedPracticeAreas.length === 0) {
      toast({
        title: "Search Parameters Required",
        description: "Please enter a search term, select a province, or choose practice areas.",
        variant: "destructive",
      });
      return;
    }

    await searchAttorneys({
      query: searchQuery.trim() || undefined,
      province: selectedProvince || undefined,
      practice_areas: selectedPracticeAreas.length > 0 ? selectedPracticeAreas : undefined,
      role: selectedRoles.length > 0 ? selectedRoles : undefined,
      limit: 20
    });
    setActiveTab("results");
  };

  const handlePracticeAreaToggle = (area: string) => {
    setSelectedPracticeAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceText = (score: number) => {
    if (score >= 0.8) return "High";
    if (score >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contact className="h-5 w-5 text-kutlwano-blue" />
            CRM Attorney Directory
          </CardTitle>
          <CardDescription>
            Search and manage South African attorney contacts for RAF, assault, and medical negligence cases
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Results ({results.length})
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Government ({governmentInstitutions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search Query</label>
                <Input
                  placeholder="Enter attorney name, firm name, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Province</label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select province (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Provinces</SelectItem>
                    {provinces.map(province => (
                      <SelectItem key={province} value={province}>{province}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Practice Areas</label>
                <div className="flex flex-wrap gap-2">
                  {practiceAreas.map(area => (
                    <Badge
                      key={area}
                      variant={selectedPracticeAreas.includes(area) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handlePracticeAreaToggle(area)}
                    >
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Attorney Role</label>
                <div className="flex flex-wrap gap-2">
                  {roles.map(role => (
                    <Badge
                      key={role}
                      variant={selectedRoles.includes(role) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleRoleToggle(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSearch} 
                  disabled={loading}
                  className="flex-1 bg-gradient-primary hover:shadow-glow"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Search Attorneys"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    clearResults();
                    setSearchQuery("");
                    setSelectedProvince("");
                    setSelectedPracticeAreas([]);
                    setSelectedRoles([]);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {results.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No attorneys found. Try adjusting your search criteria.</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {results.map((attorney) => (
              <Card key={attorney.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{attorney.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {attorney.firm}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getConfidenceColor(attorney.confidence_score)}`} />
                      <span className="text-xs text-muted-foreground">
                        {getConfidenceText(attorney.confidence_score)} Confidence
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{attorney.role}</Badge>
                        <Badge variant="outline">{attorney.seniority}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{attorney.city}, {attorney.province}</span>
                      </div>
                      
                      {attorney.phone_primary && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4" />
                          <span>{attorney.phone_primary}</span>
                        </div>
                      )}
                      
                      {attorney.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4" />
                          <span>{attorney.email}</span>
                        </div>
                      )}
                      
                      {attorney.website && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4" />
                          <a href={attorney.website} target="_blank" rel="noopener noreferrer" 
                             className="text-kutlwano-blue hover:underline">
                            Website
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Practice Areas:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {attorney.practice_areas.map(area => (
                            <Badge key={area} variant="outline" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {attorney.years_practicing && (
                        <div className="text-sm">
                          <span className="font-medium">Experience:</span> {attorney.years_practicing} years
                        </div>
                      )}
                      
                      {attorney.bar_admission_number && (
                        <div className="text-sm">
                          <span className="font-medium">Bar Number:</span> {attorney.bar_admission_number}
                        </div>
                      )}
                      
                      {attorney.notes && (
                        <div className="text-sm">
                          <span className="font-medium">Notes:</span> {attorney.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Add to Contacts
                    </Button>
                    <Button size="sm" variant="outline">
                      <Star className="h-3 w-3 mr-1" />
                      Mark as Lead
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="government" className="space-y-4">
          {governmentInstitutions.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No government institutions found. Perform a search to discover relevant contacts.</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {governmentInstitutions.map((institution, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{institution.institution}</CardTitle>
                  <CardDescription>{institution.unit}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>{institution.province}</span>
                  </div>
                  
                  {institution.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" />
                      <span>{institution.phone}</span>
                    </div>
                  )}
                  
                  {institution.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      <span>{institution.email}</span>
                    </div>
                  )}
                  
                  {institution.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4" />
                      <a href={institution.website} target="_blank" rel="noopener noreferrer" 
                         className="text-kutlwano-blue hover:underline">
                        Official Website
                      </a>
                    </div>
                  )}
                  
                  <p className="text-sm">{institution.address}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};