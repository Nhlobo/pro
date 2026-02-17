import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, MapPin, Clock, ArrowLeft, Building2,
  MessageSquare, Globe, Printer
} from 'lucide-react';

const ContactUs: React.FC = () => {
  const navigate = useNavigate();

  const ContactCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    lines: string[];
    action?: { label: string; href: string };
    color?: string;
  }> = ({ icon, title, lines, action, color = 'primary' }) => (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-${color}/10 border border-${color}/20 shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm mb-2">{title}</h3>
            {lines.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            ))}
            {action && (
              <a
                href={action.href}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:underline"
              >
                {action.label}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet>
        <title>Contact Us – Kutlwano & Associate</title>
        <meta name="description" content="Get in touch with Kutlwano & Associate Medico-Legal Services" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        {/* Branded Header */}
        <header
          className="sticky top-0 z-50 w-full border-b shadow-md"
          style={{ background: 'linear-gradient(135deg, hsl(var(--kutlwano-blue)), hsl(var(--kutlwano-teal)))' }}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="text-white/80 hover:text-white hover:bg-white/10 px-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="bg-white/10 backdrop-blur-sm p-1.5 rounded-lg border border-white/20 shrink-0">
                  <img
                    src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png"
                    alt="Kutlwano & Associate Logo"
                    className="h-9 w-auto object-contain brightness-0 invert"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-white font-bold text-base leading-tight">Kutlwano & Associate (Pty) Ltd</h1>
                  <p className="text-white/75 text-xs leading-tight">Medico-Legal Services</p>
                </div>
              </div>
            </div>
            <div className="h-0.5 bg-white/20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-10 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 border border-primary/20 w-fit">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Contact Us</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              We're here to assist you with any queries regarding your case, appointments, reports, or account.
              Reach out to us through any of the channels below.
            </p>
            <p className="mt-3 text-xs text-muted-foreground italic">
              "We Touch a File, We Change a Life, We are Kutlwano & Associate"
            </p>
          </div>

          {/* Contact Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <ContactCard
              icon={<Phone className="h-5 w-5 text-primary" />}
              title="Telephone"
              lines={[
                'Main: +27 (0) 11 XXX XXXX',
                'Cell: +27 (0) 8X XXX XXXX',
              ]}
              action={{ label: 'Call us', href: 'tel:+27110000000' }}
            />

            <ContactCard
              icon={<Printer className="h-5 w-5 text-secondary" />}
              title="Fax"
              lines={[
                'Fax: +27 (0) 11 XXX XXXX',
                'Or email documents directly',
              ]}
              color="secondary"
            />

            <ContactCard
              icon={<Mail className="h-5 w-5 text-primary" />}
              title="Email Addresses"
              lines={[
                'General: info@kamedico-legal.co.za',
                'Accounts: accounts@kamedico-legal.co.za',
                'Reports: reports@kamedico-legal.co.za',
              ]}
              action={{ label: 'Send email', href: 'mailto:info@kamedico-legal.co.za' }}
            />

            <ContactCard
              icon={<Globe className="h-5 w-5 text-secondary" />}
              title="Website"
              lines={[
                'www.kamedico-legal.co.za',
                'Client portal available 24/7',
              ]}
              action={{ label: 'Visit website', href: 'https://kamedico-legal.co.za' }}
              color="secondary"
            />
          </div>

          {/* Office Address Full Width */}
          <Card className="border-primary/20 bg-primary/5 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Office / Physical Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Kutlwano & Associate (Pty) Ltd</p>
              <p className="text-sm text-muted-foreground">Unit X, Building Name</p>
              <p className="text-sm text-muted-foreground">Street Address, Suburb</p>
              <p className="text-sm text-muted-foreground">City, Province, XXXX</p>
              <p className="text-sm text-muted-foreground">South Africa</p>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Postal Address: P.O. Box XXXXX, City, XXXX</span>
              </div>
            </CardContent>
          </Card>

          {/* Office Hours */}
          <Card className="border-secondary/20 bg-secondary/5 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                Office Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monday – Friday</span>
                  <span className="font-medium">08:00 – 17:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saturday</span>
                  <span className="font-medium">09:00 – 13:00</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Sunday & Public Holidays</span>
                  <span className="text-destructive font-medium">Closed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Back button */}
          <div className="text-center">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Go Back
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Kutlwano & Associate (Pty) Ltd · All Rights Reserved</p>
          <p className="mt-1 italic">"We Touch a File, We Change a Life, We are Kutlwano & Associate"</p>
        </footer>
      </div>
    </>
  );
};

export default ContactUs;
