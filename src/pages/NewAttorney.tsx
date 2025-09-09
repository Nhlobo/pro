import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useAttorneys } from "@/hooks/useAttorneys";
import { useAuth } from "@/hooks/useAuth";
import CompanyFooter from "@/components/CompanyFooter";
import { Helmet } from "react-helmet-async";

const NewAttorney = () => {
  const navigate = useNavigate();
  const { createAttorney } = useAttorneys();
  const { session } = useAuth();
  
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    specialization: [] as string[],
    email: "",
    phone: "",
    law_firm: "",
    address: "",
    status: 'potential' as const,
  });
  
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSpecializationAdd = () => {
    if (selectedSpecialization && !formData.specialization.includes(selectedSpecialization)) {
      setFormData(prev => ({
        ...prev,
        specialization: [...prev.specialization, selectedSpecialization]
      }));
      setSelectedSpecialization("");
    }
  };

  const handleSpecializationRemove = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specialization: prev.specialization.filter(s => s !== spec)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    setLoading(true);
    try {
      // Get current user's law firm from profile
      const lawFirmResponse = await fetch('/api/get-user-law-firm'); // This would need to be implemented
      
      const attorney = await createAttorney({
        ...formData,
        law_firm_id: session.user.id, // This should be the actual law firm ID
      });

      if (attorney) {
        navigate(`/crm/attorney/${attorney.id}`);
      }
    } catch (error) {
      // Error handled by hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Add New Attorney - CRM</title>
        <meta name="description" content="Add a new attorney to your CRM system. Capture contact details, specializations, and start tracking lead progression." />
      </Helmet>

      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/crm')} 
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to CRM
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Add New Attorney</h1>
              <p className="text-muted-foreground mt-1">Create a new attorney record in your CRM</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Attorney Information
              </CardTitle>
              <CardDescription>
                Enter the attorney's details to start tracking this lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="law_firm">Law Firm</Label>
                    <Input
                      id="law_firm"
                      value={formData.law_firm}
                      onChange={(e) => setFormData(prev => ({ ...prev, law_firm: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Province"
                  />
                </div>

                <div>
                  <Label>Specializations</Label>
                  <div className="flex gap-2 mb-2">
                    <Select value={selectedSpecialization} onValueChange={setSelectedSpecialization}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select specialization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medico-legal">Medico-Legal</SelectItem>
                        <SelectItem value="RAF">RAF</SelectItem>
                        <SelectItem value="negligence">Negligence</SelectItem>
                        <SelectItem value="personal-injury">Personal Injury</SelectItem>
                        <SelectItem value="medical-malpractice">Medical Malpractice</SelectItem>
                        <SelectItem value="workers-compensation">Workers Compensation</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleSpecializationAdd}>
                      Add
                    </Button>
                  </div>
                  
                  {formData.specialization.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.specialization.map((spec, index) => (
                        <div key={index} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm">
                          {spec}
                          <button 
                            type="button"
                            onClick={() => handleSpecializationRemove(spec)}
                            className="ml-1 text-destructive hover:text-destructive/80"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Full address including postal code"
                    rows={3}
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Creating..." : "Create Attorney"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/crm')}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default NewAttorney;