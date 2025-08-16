import React from "react";
import { Helmet } from "react-helmet-async";
import DocumentUploadSystem from "@/components/DocumentUploadSystem";
import CompanyFooter from "@/components/CompanyFooter";

const DocumentUploading = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-uploading';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Document Upload System - Medico-Legal Assessment System</title>
        <meta name="description" content="Upload and manage instruction letters, claimant ID copies, medical records, and expert reports with automatic date/time tracking and referring attorney reference." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-bold">Document Upload System</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Upload and manage instruction letters, claimant ID copies, medical records, and expert reports with automatic tracking and referring attorney reference.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <DocumentUploadSystem />
      </main>
      <CompanyFooter />
    </div>
  );
};

export default DocumentUploading;