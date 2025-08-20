import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, Calendar, BarChart3, Shield, CheckCircle2 } from 'lucide-react';

const Landing: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-kutlwano-blue/10 to-kutlwano-teal/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kutlwano-blue"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: <FileText className="h-8 w-8 text-kutlwano-blue" />,
      title: "Document Management",
      description: "Comprehensive system for managing medical reports, legal documents, and case files"
    },
    {
      icon: <Users className="h-8 w-8 text-kutlwano-blue" />,
      title: "Expert Directory",
      description: "Access to medical experts across all provinces with detailed profiles and specializations"
    },
    {
      icon: <Calendar className="h-8 w-8 text-kutlwano-blue" />,
      title: "Appointment Scheduling",
      description: "Streamlined booking system for medical assessments and expert consultations"
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-kutlwano-blue" />,
      title: "Analytics & Reporting",
      description: "Detailed insights into case progress, expert performance, and business metrics"
    },
    {
      icon: <Shield className="h-8 w-8 text-kutlwano-blue" />,
      title: "Secure & Compliant",
      description: "Role-based access control ensuring data security and regulatory compliance"
    },
    {
      icon: <CheckCircle2 className="h-8 w-8 text-kutlwano-blue" />,
      title: "Quality Assurance",
      description: "Automated tracking and quality control for all medico-legal processes"
    }
  ];

  return (
    <>
      <Helmet>
        <title>Kutlwano & Associate - Medico Legal Management System</title>
        <meta name="description" content="Professional medico-legal case management system for law firms and medical experts. Streamline your legal practice with comprehensive tools." />
        <meta name="keywords" content="medico legal, case management, legal software, medical experts, law firm management" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-kutlwano-blue/5 via-background to-kutlwano-teal/5">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Kutlwano & Associate</h1>
                <p className="text-sm text-muted-foreground">Medico Legal Services</p>
              </div>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:opacity-90"
              >
                Sign In
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Professional
              <span className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal bg-clip-text text-transparent"> Medico-Legal </span>
              Management
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Comprehensive case management system designed for law firms specializing in medico-legal services. 
              Streamline your practice with advanced tools for document management, expert coordination, and case tracking.
            </p>
            <div className="bg-gradient-to-r from-kutlwano-blue/10 to-kutlwano-teal/10 border border-kutlwano-blue/20 rounded-lg p-6 max-w-2xl mx-auto">
              <p className="text-lg font-medium text-kutlwano-blue italic">
                "We touch a file, We change a life, We are Kutlwano and Associate"
              </p>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-background/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Comprehensive System Features
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to manage your medico-legal practice efficiently and professionally
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="border-border/50 hover:border-kutlwano-blue/30 transition-colors group">
                  <CardHeader>
                    <div className="mb-4 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <Card className="max-w-4xl mx-auto border-kutlwano-blue/20 bg-gradient-to-r from-kutlwano-blue/5 to-kutlwano-teal/5">
              <CardContent className="p-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Ready to Transform Your Practice?
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Access the complete medico-legal management system with role-based permissions, 
                  comprehensive reporting, and advanced case tracking capabilities.
                </p>
                <Button 
                  size="lg"
                  onClick={() => window.location.href = '/auth'}
                  className="bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:opacity-90 px-8 py-3 text-lg"
                >
                  Access System
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-background/80 py-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">Kutlwano & Associate (Pty) Ltd</p>
                <p className="text-sm text-muted-foreground">Professional Medico Legal Services</p>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2024 Kutlwano & Associate. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;