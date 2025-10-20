import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SecureDataDisplay } from "@/components/SecureDataDisplay";
import { ArrowLeft, Search, Building2, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import QuickAppointmentRequest from "@/components/QuickAppointmentRequest";
import { useResponseRatings } from "@/hooks/useResponseRatings";

type ReferringAttorney = {
  id: string;
  name: string;
  contact_person: string;
  phone_masked: string;
  email_masked: string;
  attorney_role: string;
  province: string;
  code: string;
  created_at: string;
};

const ReferringAttorneyList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getRecentRating } = useResponseRatings();
  const [searchTerm, setSearchTerm] = useState("");
  const [attorneys, setAttorneys] = useState<ReferringAttorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentRating, setRecentRating] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attorneyToDelete, setAttorneyToDelete] = useState<ReferringAttorney | null>(null);

  useEffect(() => {
    fetchAttorneys();
    loadRecentRating();
  }, []);

  const loadRecentRating = async () => {
    const rating = await getRecentRating();
    setRecentRating(rating);
  };

  const fetchAttorneys = async () => {
    try {
      setLoading(true);
      // Use secure function to get law firms with properly masked sensitive data
      const { data, error } = await supabase
        .rpc('get_law_firms_list');

      if (error) {
        console.error('Error fetching attorneys:', error);
        toast({
          title: "Error",
          description: "Failed to fetch referring attorneys. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setAttorneys(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred.",
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

  const handleDeleteClick = (attorney: ReferringAttorney) => {
    setAttorneyToDelete(attorney);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attorneyToDelete) return;

    try {
      const { error } = await supabase
        .from('law_firms')
        .delete()
        .eq('id', attorneyToDelete.id);

      if (error) {
        console.error('Error deleting attorney:', error);
        toast({
          title: "Error",
          description: "Failed to delete attorney. You may not have permission.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Attorney deleted successfully.",
      });

      // Refresh the list
      await fetchAttorneys();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAttorneyToDelete(null);
    }
  };

  const handleEdit = (attorneyId: string) => {
    navigate(`/referring-attorney-update/${attorneyId}`);
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
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/appointment-request">
                  Request Appointment
                </Link>
              </Button>
              <Button asChild>
                <Link to="/referring-attorney">
                  Add New Attorney
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <QuickAppointmentRequest recentResponseRating={recentRating} />
        
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading attorneys...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttorneys.map((attorney) => (
                      <TableRow key={attorney.id}>
                        <TableCell className="font-medium">{attorney.code}</TableCell>
                        <TableCell className="font-medium">{attorney.name}</TableCell>
                        <TableCell>{attorney.contact_person}</TableCell>
                        <TableCell>
                          <SecureDataDisplay
                            data={attorney.phone_masked}
                            type="phone"
                            label=""
                            showIcon={false}
                            requiresPermission="view_law_firm_contacts"
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <SecureDataDisplay
                            data={attorney.email_masked}
                            type="email"
                            label=""
                            showIcon={false}
                            requiresPermission="view_law_firm_contacts"
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>{attorney.province}</TableCell>
                        <TableCell>
                          {getRoleBadge(attorney.attorney_role)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(attorney.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(attorney)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the attorney "{attorneyToDelete?.name}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyList;