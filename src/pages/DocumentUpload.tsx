import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentUploadForm from "@/components/DocumentUploadForm";
import CompanyFooter from "@/components/CompanyFooter";

const DocumentUpload = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-upload';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Upload Document - Medico-Legal Assessment System</title>
        <meta name="description" content="Upload instruction letters, claimant ID copies, medical records, X-rays, and medico-reports with automatic date/time tracking and referring attorney reference." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="relative">
            <Link to="/" className="inline-block mb-4">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">Upload Document</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Upload documents one at a time. Select the document type from the dropdown and attach your file.
            </p>
            <div className="mt-4">
              <Link to="/document-uploading">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  View Uploaded Documents
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <DocumentUploadForm />
      </main>
      <CompanyFooter />
    </div>
  );
};

export default DocumentUpload;