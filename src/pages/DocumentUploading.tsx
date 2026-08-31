import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardStickyHeader from "@/components/dashboard/DashboardStickyHeader";
import DocumentsList from "@/components/DocumentsList";
import CompanyFooter from "@/components/CompanyFooter";

const DocumentUploading = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-uploading';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Uploaded Documents - Medico-Legal Assessment System</title>
        <meta name="description" content="View and manage uploaded instruction letters, claimant ID copies, medical records, X-rays, and medico-reports with search and filtering capabilities." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <DashboardStickyHeader
        title="Uploaded Documents"
        subtitle="View, manage, and download instruction letters, claimant ID copies, medical records, X-rays, and medico-reports."
        actions={
          <Button size="sm" className="gap-1 bg-white text-[#0F7A9C] hover:bg-white/90" asChild>
            <Link to="/document-upload">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Upload New Document</span>
            </Link>
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-6">
        <DocumentsList />
      </main>
      <CompanyFooter />
    </div>
  );
};

export default DocumentUploading;
