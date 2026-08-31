// src/pages/ExpertCreditControl.tsx
import React from "react";
import { Helmet } from "react-helmet-async";
import CompanyFooter from "@/components/CompanyFooter";
import { ExpertCreditControlContent } from "@/components/admin/ExpertCreditControlContent";
import DashboardStickyHeader from "@/components/dashboard/DashboardStickyHeader";

/**
 * Standalone route (/expert-credit-control). Owns the page chrome — header,
 * "Back to Dashboard", footer — that only makes sense when this is the
 * whole page. The Expert Network "Credit Control" tab renders the same
 * content directly via ExpertCreditControlModule, without any of this
 * chrome, since it already lives inside the Admin Portal's own layout.
 */
const ExpertCreditControl = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Expert Credit Control - Track Expert Payments</title>
        <meta
          name="description"
          content="Track amounts owed to medical experts - Total Due, Deposit Received, and Balance Due for each appointment."
        />
      </Helmet>

      <DashboardStickyHeader
        title="Expert Credit Control"
        subtitle="Track what is owed to medical experts per booked appointment — Total Due, Deposit Received, and Balance Due"
      />

      <main className="container mx-auto px-4 py-8">
        <ExpertCreditControlContent />
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ExpertCreditControl;
