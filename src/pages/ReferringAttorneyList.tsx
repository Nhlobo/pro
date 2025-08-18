import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";

type ReferringAttorney = {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  attorney_role: string;
  province: string;
  matter_type: string;
  code: string;
  created_at: string;
};

const ReferringAttorneyList = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [attorneys, setAttorneys] = useState<ReferringAttorney[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttorneys();
  }, []);

  const fetchAttorneys = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('law_firms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAttorneys(data || []);
    } catch (error) {
      console.error('Error fetching attorneys:', error);
      toast({
        title: "Error",
        description: "Failed to fetch referring attorneys. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAttorneys = attorneys.filter(attorney =>
    attorney.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.province.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMatterTypeBadge = (matterType: string) => {
    switch (matterType) {
      case "mva": return <Badge variant="default">MVA</Badge>;
      case "med_neg": return <Badge variant="secondary">Med Neg</Badge>;
      case "both": return <Badge variant="outline">Both</Badge>;
      default: return <Badge variant="secondary">{matterType}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    return (
      <Badge variant={role === "Plaintiff" ? "default" : "secondary"}>
        {role}
      </Badge>
    );
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/referring-attorney-list';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney List - Medico-Legal Assessment System</title>
        <meta name="description" content="View and manage all referring attorneys with their contact details, roles, and matter types." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Referring Attorney List</h1>
            </div>
            <Button asChild>
              <Link to="/referring-attorney">
                Add New Attorney
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Referring Attorneys Directory
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, code, or province..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Law Firm Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Matter Type</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading attorneys...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttorneys.map((attorney) => (
                      <TableRow key={attorney.id}>
                        <TableCell className="font-medium">{attorney.code}</TableCell>
                        <TableCell className="font-medium">{attorney.name}</TableCell>
                        <TableCell>{attorney.contact_person}</TableCell>
                        <TableCell>{attorney.phone}</TableCell>
                        <TableCell>{attorney.email}</TableCell>
                        <TableCell>{attorney.province}</TableCell>
                        <TableCell>
                          {getRoleBadge(attorney.attorney_role)}
                        </TableCell>
                        <TableCell>
                          {getMatterTypeBadge(attorney.matter_type)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{attorney.address}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {filteredAttorneys.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No referring attorneys found. {searchTerm && "Try adjusting your search terms."}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyList;