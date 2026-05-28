// Maps URL paths to friendly activity labels for time-spent tracking.
// Order matters: longest/most-specific prefixes first.

const PREFIX_LABELS: Array<[string, string]> = [
  ["/admin/sales-performance", "Sales Performance Reports"],
  ["/admin/attorney-crm", "Attorney CRM"],
  ["/admin/cases", "Case Management"],
  ["/admin/experts", "Expert Network"],
  ["/admin/find-experts", "Find Experts"],
  ["/admin/find-attorneys", "Find Attorneys"],
  ["/admin/heatmap", "Availability Heatmap"],
  ["/admin/reports", "Report Management"],
  ["/admin/reporting", "Reporting Dashboard"],
  ["/admin/documents", "Document Vault"],
  ["/admin/finance", "Finance"],
  ["/admin/expert-payment-planner", "Expert Payment Planner"],
  ["/admin/appointments", "Appointments"],
  ["/admin/analytics", "Analytics"],
  ["/admin/iam", "User & Access"],
  ["/admin/system-control", "System Control"],
  ["/admin/support", "Support Hub"],
  ["/admin/my-profile", "My Profile"],
  ["/admin", "Admin Dashboard"],

  ["/expert-portal/cases", "Expert Cases"],
  ["/expert-portal/schedule", "Expert Schedule"],
  ["/expert-portal/report-tracking", "Expert Report Tracking"],
  ["/expert-portal/performance", "Expert Performance"],
  ["/expert-portal/profile", "Expert Profile"],
  ["/expert-portal", "Expert Dashboard"],

  ["/Attorneyzone", "Attorney Portal"],
  ["/Expertzone", "Expert Portal"],

  ["/aod-payment-tracking", "AOD Payment Tracking"],
  ["/aod-management", "AOD Management"],
  ["/aod-balance-summary", "AOD Balance Summary"],
  ["/debtors-control", "Debtors Control"],
  ["/expert-credit-control", "Expert Credit Control"],
  ["/expert-report-tracking", "Expert Report Tracking"],
  ["/expert-reports", "Expert Reports"],
  ["/report-management", "Report Management"],
  ["/report-tracking", "Report Tracking"],
  ["/case-management-reports", "Case Management Reports"],
  ["/assessment-reports-statistics", "Assessment Statistics"],
  ["/appointment-checklist", "Appointment Checklist"],
  ["/appointment-request-dashboard", "Appointment Requests"],
  ["/appointment-request", "Appointment Request"],
  ["/new-appointment", "New Appointment"],
  ["/scheduled-assessment", "Scheduled Assessments"],
  ["/claimant-reports", "Claimant Reports"],
  ["/claimant-list", "Claimant List"],
  ["/claimant", "Claimant Form"],
  ["/referring-attorney-list", "Attorney List"],
  ["/referring-attorney-report", "Attorney Reports"],
  ["/referring-attorney-update", "Attorney Update"],
  ["/referring-attorney-profile", "Attorney Profile"],
  ["/referring-attorney", "Attorney Form"],
  ["/medical-expert-directory", "Expert Directory"],
  ["/medical-expert-form", "Expert Form"],
  ["/medical-expert", "Medical Expert"],
  ["/recently-added-experts", "Recently Added Experts"],
  ["/document-upload", "Document Upload"],
  ["/document-uploading", "Document Uploading"],
  ["/document-proofreading", "Document Proofreading"],
  ["/document-checklist", "Document Checklist"],
  ["/sample-reports", "Sample Reports"],
  ["/deleted-appointments", "Deleted Appointments"],
  ["/email-queue", "Email Queue"],
  ["/workflow-automation", "Workflow Automation"],
  ["/attorney-referral-intelligence", "Referral Intelligence"],
  ["/attorney-pitchlog", "Attorney Pitchlog"],
  ["/sales-dashboard", "Sales Dashboard"],
  ["/security-settings", "Security Settings"],
  ["/audit-trail", "Audit Trail"],
  ["/permission-management", "Permission Management"],
  ["/user-management", "User Management"],
  ["/edit-requests", "Edit Requests"],
  ["/dashboard", "Dashboard"],
];

const humanise = (path: string) => {
  const seg = path.split("/").filter(Boolean)[0] || "Home";
  return seg
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function resolveActivity(pathname: string): { key: string; label: string } {
  for (const [prefix, label] of PREFIX_LABELS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { key: prefix.replace(/^\//, "").replace(/\//g, "-") || "home", label };
    }
  }
  return { key: pathname.replace(/^\//, "").split("/")[0] || "home", label: humanise(pathname) };
}
