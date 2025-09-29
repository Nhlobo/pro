import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search, MapPin, Phone, Mail, Globe, Users, FileText, Building2 } from "lucide-react";
import { useAttorneySearch, AttorneySearchParams } from "@/hooks/useAttorneySearch";
import CompanyFooter from "@/components/CompanyFooter";

const provinces = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Free State'
];

const practiceAreas = [
  { value: 'RAF', label: 'Road Accident Fund' },
  { value: 'Assault', label: 'Assault & Personal Injury' },
  { value: 'Medical Negligence', label: 'Medical Negligence' },
  { value: 'Criminal Law', label: 'Criminal Law' },
  { value: 'Civil Litigation', label: 'Civil Litigation' },
  { value: 'Commercial Law', label: 'Commercial Law' }
];

const roles = [
  { value: 'Plaintiff', label: 'Plaintiff Attorney' },
  { value: 'Defence', label: 'Defence Attorney' },
  { value: 'State', label: 'State Attorney' }
];

const AttorneyDirectorySearch = () => {
  const { results, governmentInstitutions, loading, searchAttorneys, clearResults } = useAttorneySearch();
  const [searchParams, setSearchParams] = useState<AttorneySearchParams>({
    query: '',
    province: '',
    practice_areas: [],
    role: [],
    limit: 20
  });

  const handleSearch = () => {
    if (!searchParams.query && !searchParams.province && !searchParams.practice_areas?.length) {
      return;
    }
    searchAttorneys(searchParams);
  };

  const handlePracticeAreaChange = (area: string, checked: boolean) => {
    const newAreas = checked
      ? [...(searchParams.practice_areas || []), area]
      : (searchParams.practice_areas || []).filter(a => a !== area);
    
    setSearchParams(prev => ({ ...prev, practice_areas: newAreas }));
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    const newRoles = checked
      ? [...(searchParams.role || []), role]
      : (searchParams.role || []).filter(r => r !== role);
    
    setSearchParams(prev => ({ ...prev, role: newRoles }));
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Attorney Directory Search - Medico-Legal Assessment System</title>
        <meta name="description" content="Search comprehensive attorney directory with advanced filtering by practice areas, location, and specialization." />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Attorney Directory Search</h1>
          <p className="text-muted-foreground mt-2">
            Find attorneys by practice area, location, and specialization
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="search-query">Search Query</Label>
                <Input
                  id="search-query"
                  placeholder="Attorney name, firm, or keywords..."
                  value={searchParams.query}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, query: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="province-select">Province</Label>
                <Select 
                  value={searchParams.province} 
                  onValueChange={(value) => setSearchParams(prev => ({ ...prev, province: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Provinces</SelectItem>
                    {provinces.map(province => (
                      <SelectItem key={province} value={province}>{province}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Practice Areas</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {practiceAreas.map(area => (
                  <div key={area.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={area.value}
                      checked={searchParams.practice_areas?.includes(area.value) || false}
                      onCheckedChange={(checked) => handlePracticeAreaChange(area.value, !!checked)}
                    />
                    <Label htmlFor={area.value} className="text-sm">{area.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Attorney Role</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {roles.map(role => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={role.value}
                      checked={searchParams.role?.includes(role.value) || false}
                      onCheckedChange={(checked) => handleRoleChange(role.value, !!checked)}
                    />
                    <Label htmlFor={role.value} className="text-sm">{role.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSearch} disabled={loading} className="flex-1">
                {loading ? 'Searching...' : 'Search Directory'}
              </Button>
              <Button variant="outline" onClick={clearResults}>
                Clear Results
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Search Results ({results.length})</h2>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            </div>

            <div className="grid gap-6">
              {results.map((attorney, index) => (
                <Card key={attorney.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{attorney.name}</h3>
                        <p className="text-lg text-muted-foreground">{attorney.firm}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{attorney.role}</Badge>
                          <Badge variant="outline">{attorney.seniority}</Badge>
                          {attorney.years_practicing && (
                            <Badge variant="outline">{attorney.years_practicing} years</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${getConfidenceColor(attorney.confidence_score)}`}
                          title={`Confidence: ${Math.round(attorney.confidence_score * 100)}%`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {Math.round(attorney.confidence_score * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4" />
                          <span>{attorney.city}, {attorney.province}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4" />
                          <span>{attorney.phone_primary}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4" />
                          <span>{attorney.email}</span>
                        </div>
                        {attorney.website && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4" />
                            <a 
                              href={attorney.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium">Practice Areas</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attorney.practice_areas.map(area => (
                              <Badge key={area} variant="outline" className="text-xs">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {attorney.tags.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Tags</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {attorney.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {attorney.address && attorney.address !== 'Not specified' && (
                          <div>
                            <Label className="text-sm font-medium">Address</Label>
                            <p className="text-sm text-muted-foreground">{attorney.address}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {attorney.notes && (
                      <div className="mt-4 p-3 bg-muted rounded-md">
                        <Label className="text-sm font-medium">Notes</Label>
                        <p className="text-sm text-muted-foreground mt-1">{attorney.notes}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        Last verified: {new Date(attorney.last_verified).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Users className="h-4 w-4 mr-2" />
                          Add Contact
                        </Button>
                        <Button size="sm">
                          Request Appointment
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Government Institutions */}
        {governmentInstitutions.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Government Institutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {governmentInstitutions.map((institution, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold">{institution.institution}</h4>
                    <p className="text-sm text-muted-foreground">{institution.unit}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{institution.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{institution.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{institution.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <a 
                          href={institution.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {institution.website}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {!loading && results.length === 0 && searchParams.query && (
          <Card>
            <CardContent className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No attorneys found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or broadening your filters.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <CompanyFooter />
    </div>
  );
};

export default AttorneyDirectorySearch;