import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Shield, Lock, FileText, Mail, Server, UserCheck, Database } from "lucide-react";

const Trust = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Trust & Security | Medico-Legal Pro</title>
        <meta
          name="description"
          content="How Medico-Legal Pro handles security, privacy, and data protection for attorneys, experts, and claimants."
        />
        <link rel="canonical" href="/trust" />
      </Helmet>

      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="font-semibold">Medico-Legal Pro</span>
          </Link>
          <Link to="/contact-us" className="text-sm text-muted-foreground hover:text-foreground">
            Contact
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <section className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Trust & Security</h1>
          <p className="text-muted-foreground leading-relaxed">
            This page is maintained by Medico-Legal Pro to answer common security and
            privacy questions about how we run the platform. It describes current,
            app-visible controls — it is not an independent certification or audit
            report. Security is a shared responsibility between us, our hosting
            providers, and customers using the system.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" /> Access & Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Email/password authentication with email confirmation.</p>
              <p>Role-based access control: admin, case manager, sales, attorney, and expert portals are separated.</p>
              <p>External attorney and expert access uses time-limited 12-character access codes.</p>
              <p>Sessions time out after 45 minutes of inactivity.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Data Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Row-level security is enabled on customer-facing tables so users only see records they are authorised to access.</p>
              <p>Claimant identifiers are masked for external attorney portals and unmasked only for internal admins.</p>
              <p>Privileged database functions are restricted to signed-in users; anonymous callers cannot invoke them.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" /> Hosting & Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Application hosted on Lovable; database and storage on Supabase (PostgreSQL).</p>
              <p>All traffic is served over HTTPS/TLS.</p>
              <p>Edge functions execute server-side with scoped service credentials, never exposed to the browser.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> POPIA Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Access to claimant personal information is logged in an internal audit trail.</p>
              <p>User deletion preserves audit history via anonymised references.</p>
              <p>Read notifications are purged daily; document retention policies are enforced server-side.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Documents & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Uploaded documents are stored in access-controlled Supabase storage buckets.</p>
              <p>Document Vault uses multi-role RBAC; only authorised roles may view, download, or delete files.</p>
              <p>OCR processing runs server-side; raw files are not shared with third parties beyond approved processors.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Monitoring & Response
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Structured logs and correlation IDs are emitted for sensitive workflows (e.g. queued email dispatch).</p>
              <p>Administrative system events generate in-app notifications for the operations team.</p>
              <p>Security findings are reviewed regularly and tracked to remediation.</p>
            </CardContent>
          </Card>
        </div>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Reporting a security issue
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you believe you have found a security vulnerability, please contact us
            through the{" "}
            <Link to="/contact-us" className="text-primary underline">
              contact page
            </Link>{" "}
            with a description of the issue and steps to reproduce. We will
            acknowledge your report and work with you on remediation.
          </p>
        </section>

        <footer className="mt-12 text-xs text-muted-foreground">
          <p>
            This page reflects the current configuration of the Medico-Legal Pro
            application and is updated as the platform evolves. It does not
            constitute a legal warranty or third-party attestation.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Trust;
