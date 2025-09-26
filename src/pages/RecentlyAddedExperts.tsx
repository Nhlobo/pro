import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, MapPin, CheckCircle, Calendar, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import PermissionGuard from "@/components/PermissionGuard";

interface SavedExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  consultation_fees?: number;
  court_fees?: number;
  created_at: string;
  years_experience?: number;
  specializations?: string[];
}

const RecentlyAddedExperts = () => {
  const [recentExperts, setRecentExperts] = useState<SavedExpert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentExperts();
  }, []);

  const fetchRecentExperts = async () => {
    try {
      setLoading(true);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type, province, consultation_fees, court_fees, created_at, years_experience, specializations')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentExperts(data || []);
    } catch (error) {
      console.error('Error fetching recent experts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatExpertType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatProvince = (province: string) => {
    const provinceMap: Record<string, string> = {
      gauteng: "Gauteng",
      western_cape: "Western Cape",
      kwazulu_natal: "KwaZulu-Natal",
      eastern_cape: "Eastern Cape",
      limpopo: "Limpopo",
      mpumalanga: "Mpumalanga",
      north_west: "North West",
      free_state: "Free State",
      northern_cape: "Northern Cape"
    };
    return provinceMap[province] || province;
  };

  const formatSpecializations = (specializations?: string[]) => {
    if (!specializations || specializations.length === 0) return '';
    return specializations.map(spec => {
      if (spec === 'mva') return 'MVA';
      if (spec === 'med_neg') return 'Med Neg';
      return spec;
    }).join(', ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading recently added experts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Recently Added Experts - Medical Expert Directory</title>
        <meta 
          name="description" 
          content="View recently added medical experts to the directory within the last 30 days" 
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/medical-expert-directory" 
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                Recently Added Experts
              </h1>
              <p className="text-muted-foreground mt-2">
                Medical experts added to the directory within the last 30 days
              </p>
            </div>
            <PermissionGuard permission={["admin", "employee"]}>
              <Link to="/medical-expert-form">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Expert
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>

        {recentExperts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Recent Additions</h3>
              <p className="text-muted-foreground mb-6">
                No medical experts have been added to the directory in the last 30 days.
              </p>
              <PermissionGuard permission={["admin", "employee"]}>
                <Link to="/medical-expert-form">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Expert
                  </Button>
                </Link>
              </PermissionGuard>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {recentExperts.length} recently added expert(s)</span>
              </div>
              <Button onClick={fetchRecentExperts} variant="outline" size="sm">
                Refresh List
              </Button>
            </div>

            <div className="space-y-4">
              {recentExperts.map((expert) => (
                <Card key={expert.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-xl text-foreground">
                          Dr. {expert.first_name} {expert.last_name}
                        </h3>
                        <p className="text-muted-foreground text-lg">
                          {formatExpertType(expert.expert_type)}
                        </p>
                        {expert.specializations && expert.specializations.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {expert.specializations.map((spec, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {spec === 'mva' ? 'MVA' : spec === 'med_neg' ? 'Medical Negligence' : spec}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-2">
                          {formatProvince(expert.province)}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Added {new Date(expert.created_at).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>ID: {expert.id.slice(0, 8)}...</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{formatProvince(expert.province)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-center font-bold text-primary">R</span>
                        <span>
                          Consultation: {expert.consultation_fees ? `R${expert.consultation_fees.toLocaleString()}` : 'TBC'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-center font-bold text-secondary">R</span>
                        <span>
                          Court: {expert.court_fees ? `R${expert.court_fees.toLocaleString()}` : 'TBC'}
                        </span>
                      </div>
                    </div>

                    {expert.years_experience && (
                      <div className="mt-3 text-sm text-muted-foreground">
                        Experience: {expert.years_experience} years
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      <CompanyFooter />
    </div>
  );
};

export default RecentlyAddedExperts;