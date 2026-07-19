// src/pages/ExpertCreditControl.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import CompanyFooter from "@/components/CompanyFooter";
import { ExpertCreditControlContent } from "@/components/admin/ExpertCreditControlContent";

/**
 * Standalone route (/expert-credit-control). Owns the page chrome — header,
 * "Back to Dashboard", footer — that only makes sense when this is the
 * whole page. The Expert Network "Credit Control" tab renders the same
 * content directly via ExpertCreditControlModule, without any of this
 * chrome, since it already lives inside the Admin Portal's own layout.
 */
const ExpertCreditControl = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Expert Credit Control - Track Expert Payments</title>
        <meta
          name="description"
          content="Track amounts owed to medical experts - Total Due, Deposit Received, and Balance Due for each appointment."
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-2">Expert Credit Control</h1>
          <p className="text-muted-foreground">
            Track what is owed to medical experts per booked appointment - Total Due, Deposit Received, and Balance Due
          </p>
        </div>

        <ExpertCreditControlContent />
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ExpertCreditControl;
