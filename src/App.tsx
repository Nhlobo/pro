import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SecurityProvider } from "@/components/SecurityProvider";
import { AppointmentSyncProvider } from "@/contexts/AppointmentSyncContext";
import { ConfirmDialogProvider } from "@/hooks/useConfirm";
import { HelmetProvider } from "react-helmet-async";
import NetworkStatus from "@/components/NetworkStatus";
import { ActivityTrackerMount } from "@/hooks/useActivityTracker";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionProtectedRoute from "./components/PermissionProtectedRoute";
import { GlobalErrorBoundary, installGlobalErrorHandlers } from "@/components/GlobalErrorBoundary";

// Eager: top-level entry points + portal layouts (small, always needed when in portal)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Offline from "./pages/Offline";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Help from "./pages/legal/Help";
import AdminPortalLayout from "./components/portal/AdminPortalLayout";
import ExpertPortalLayout from "./components/portal/ExpertPortalLayout";

// Lazy-loaded pages — each becomes its own chunk, downloaded only when the route is visited
const Index = lazy(() => import("./pages/Index"));
const Health = lazy(() => import("./pages/Health"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const EmailConfirmation = lazy(() => import("./pages/EmailConfirmation"));
const ReferringAttorneyForm = lazy(() => import("./pages/ReferringAttorneyForm"));
const ReferringAttorneyList = lazy(() => import("./pages/ReferringAttorneyList"));
const ReferringAttorneyReport = lazy(() => import("./pages/ReferringAttorneyReport"));
const ReferringAttorneyUpdate = lazy(() => import("./pages/ReferringAttorneyUpdate"));
const ReferringAttorneyProfile = lazy(() => import("./pages/ReferringAttorneyProfile"));
const AppointmentRequest = lazy(() => import("./pages/AppointmentRequest"));
const AppointmentRequestDashboard = lazy(() => import("./pages/AppointmentRequestDashboard"));
const ClaimantForm = lazy(() => import("./pages/ClaimantForm"));
const ClaimantList = lazy(() => import("./pages/ClaimantList"));
const ClaimantReports = lazy(() => import("./pages/ClaimantReports"));
const MedicalExpertForm = lazy(() => import("./pages/MedicalExpertForm"));
const MedicalExpertFormPage = lazy(() => import("./pages/MedicalExpertFormPage"));
const MedicalExpertDirectory = lazy(() => import("./pages/MedicalExpertDirectory"));
const RecentlyAddedExperts = lazy(() => import("./pages/RecentlyAddedExperts"));
const ReportTracking = lazy(() => import("./pages/ReportTracking"));
const ReportManagement = lazy(() => import("./pages/ReportManagement"));
const ExpertReports = lazy(() => import("./pages/ExpertReports"));
const ExpertReportTrackingSystem = lazy(() => import("./pages/ExpertReportTrackingSystem"));
const ExpertCreditControl = lazy(() => import("./pages/ExpertCreditControl"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const EditRequestManagement = lazy(() =>
  import("./pages/EditRequestManagement").then(m => ({ default: m.EditRequestManagement }))
);
const NewAppointment = lazy(() => import("./pages/NewAppointment"));
const ScheduledAssessment = lazy(() => import("./pages/ScheduledAssessment"));
const AppointmentChecklist = lazy(() => import("./pages/AppointmentChecklist"));
const AssessmentReportsStatistics = lazy(() => import("./pages/AssessmentReportsStatistics"));
const DocumentUpload = lazy(() => import("./pages/DocumentUpload"));
const DocumentUploading = lazy(() => import("./pages/DocumentUploading"));
const DocumentProofreading = lazy(() => import("./pages/DocumentProofreading"));
const DocumentChecklist = lazy(() => import("./pages/DocumentChecklist"));
const SampleReports = lazy(() => import("./pages/SampleReports"));
const AODManagement = lazy(() => import("./pages/AODManagement"));
const AODPaymentTracking = lazy(() => import("./pages/AODPaymentTracking"));
const AODBalanceSummary = lazy(() => import("./pages/AODBalanceSummary"));
const ReferringAttorneyDebtorsControl = lazy(() => import("./pages/ReferringAttorneyDebtorsControl"));
const DeletedAppointments = lazy(() => import("./pages/DeletedAppointments"));
const CaseManagementReports = lazy(() => import("./pages/CaseManagementReports"));
const AuditTrail = lazy(() =>
  import("./pages/AuditTrail").then(m => ({ default: m.AuditTrail }))
);
const PermissionManagement = lazy(() => import("./pages/PermissionManagement"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const EmailQueue = lazy(() => import("./pages/EmailQueue"));
const WorkflowAutomation = lazy(() => import("./pages/WorkflowAutomation"));
const AttorneyPitchlog = lazy(() => import("./pages/AttorneyPitchlog"));
const AttorneyReferralIntelligence = lazy(() => import("./pages/AttorneyReferralIntelligence"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const CaseAccess = lazy(() => import("./pages/CaseAccess"));
const ExpertCaseAccess = lazy(() => import("./pages/ExpertCaseAccess"));

// Attorney Portal Pages
const AttorneyPortalDashboard = lazy(() => import("./pages/attorney-portal/AttorneyPortalDashboard"));
const AttorneyMyCases = lazy(() => import("./pages/attorney-portal/AttorneyMyCases"));
const AttorneyAppointments = lazy(() => import("./pages/attorney-portal/AttorneyAppointments"));
const AttorneyReports = lazy(() => import("./pages/attorney-portal/AttorneyReports"));
const AttorneyPayments = lazy(() => import("./pages/attorney-portal/AttorneyPayments"));
const AttorneyAgreements = lazy(() => import("./pages/attorney-portal/AttorneyAgreements"));
const AttorneyNotifications = lazy(() => import("./pages/attorney-portal/AttorneyNotifications"));
const AttorneyCaseStatus = lazy(() => import("./pages/attorney-portal/AttorneyCaseStatus"));
const AttorneySupport = lazy(() => import("./pages/attorney-portal/AttorneySupport"));

// Expert Portal Pages
const ExpertDashboard = lazy(() => import("./pages/expert-portal/ExpertDashboard"));
const ExpertCases = lazy(() => import("./pages/expert-portal/ExpertCases"));
const ExpertCaseDetail = lazy(() => import("./pages/expert-portal/ExpertCaseDetail"));
const ExpertSchedule = lazy(() => import("./pages/expert-portal/ExpertSchedule"));
const ExpertReportTracking = lazy(() => import("./pages/expert-portal/ExpertReportTracking"));
const ExpertPerformance = lazy(() => import("./pages/expert-portal/ExpertPerformance"));
const ExpertProfile = lazy(() => import("./pages/expert-portal/ExpertProfile"));

// Admin Portal Pages
const AdminOperationsDashboard = lazy(() => import("./pages/admin/AdminOperationsDashboard"));
const AdminAttorneyCRM = lazy(() => import("./pages/admin/AdminAttorneyCRM"));
const AdminCaseManagement = lazy(() => import("./pages/admin/AdminCaseManagement"));
const AdminExpertNetwork = lazy(() => import("./pages/admin/AdminExpertNetwork"));
const AdminFindExperts = lazy(() => import("./pages/admin/AdminFindExperts"));

const AdminHeatmap = lazy(() => import("./pages/admin/AdminHeatmap"));
const AdminReportManagement = lazy(() => import("./pages/admin/AdminReportManagement"));
const AdminReportingDashboard = lazy(() => import("./pages/admin/AdminReportingDashboard"));
const AdminDocumentVault = lazy(() => import("./pages/admin/AdminDocumentVault"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance"));
const AdminExpertPaymentPlanner = lazy(() => import("./pages/admin/AdminExpertPaymentPlanner"));
const AdminAppointmentEngine = lazy(() => import("./pages/admin/AdminAppointmentEngine"));
const MyProfile = lazy(() => import("./pages/admin/MyProfile"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminIAM = lazy(() => import("./pages/admin/AdminIAM"));
const AdminSupportHub = lazy(() => import("./pages/admin/AdminSupportHub"));
const AdminSystemControl = lazy(() => import("./pages/admin/AdminSystemControl"));
const SalesPerformanceReports = lazy(() => import("./pages/admin/SalesPerformanceReports"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
});

const AdminPortalRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AdminPortalLayout>{children}</AdminPortalLayout>
  </ProtectedRoute>
);

const ExpertPortalRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <ExpertPortalLayout>{children}</ExpertPortalLayout>
  </ProtectedRoute>
);

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
    <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="Loading" />
  </div>
);

installGlobalErrorHandlers();

const App = () => (
  <GlobalErrorBoundary>
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SecurityProvider>
          <AppointmentSyncProvider>
            <ConfirmDialogProvider>
              <Toaster />
              <Sonner />
              <NetworkStatus />
              <BrowserRouter>
              <ActivityTrackerMount />
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/help" element={<Help />} />
                <Route path="/offline" element={<Offline />} />
                <Route path="/email-confirmation" element={<EmailConfirmation />} />
                <Route path="/Attorneyzone/case-access" element={<CaseAccess />} />
                <Route path="/Expertzone/case-access" element={<ExpertCaseAccess />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                
                {/* ============ ADMIN PORTAL ============ */}
                <Route path="/admin" element={<AdminPortalRoute><AdminOperationsDashboard /></AdminPortalRoute>} />
                <Route path="/admin/attorney-crm" element={<AdminPortalRoute><AdminAttorneyCRM /></AdminPortalRoute>} />
                <Route path="/admin/cases" element={<AdminPortalRoute><AdminCaseManagement /></AdminPortalRoute>} />
                <Route path="/admin/experts" element={<AdminPortalRoute><AdminExpertNetwork /></AdminPortalRoute>} />
                <Route path="/admin/find-experts" element={<AdminPortalRoute><AdminFindExperts /></AdminPortalRoute>} />
                
                <Route path="/admin/heatmap" element={<AdminPortalRoute><AdminHeatmap /></AdminPortalRoute>} />
                
                <Route path="/admin/reports" element={<AdminPortalRoute><AdminReportManagement /></AdminPortalRoute>} />
                <Route path="/admin/reporting" element={<AdminPortalRoute><AdminReportingDashboard /></AdminPortalRoute>} />
                <Route path="/admin/documents" element={<AdminPortalRoute><AdminDocumentVault /></AdminPortalRoute>} />
                <Route path="/admin/finance" element={<AdminPortalRoute><AdminFinance /></AdminPortalRoute>} />
                <Route path="/admin/expert-payment-planner" element={<AdminPortalRoute><AdminExpertPaymentPlanner /></AdminPortalRoute>} />
                <Route path="/admin/appointments" element={<AdminPortalRoute><AdminAppointmentEngine /></AdminPortalRoute>} />
                <Route path="/admin/analytics" element={<AdminPortalRoute><AdminAnalytics /></AdminPortalRoute>} />
                <Route path="/admin/iam" element={<AdminPortalRoute><AdminIAM /></AdminPortalRoute>} />
                <Route path="/admin/system-control" element={<AdminPortalRoute><AdminSystemControl /></AdminPortalRoute>} />
                <Route path="/admin/sales-performance" element={<AdminPortalRoute><SalesPerformanceReports /></AdminPortalRoute>} />
                <Route path="/admin/support" element={<AdminPortalRoute><AdminSupportHub /></AdminPortalRoute>} />
                <Route path="/admin/my-profile" element={<AdminPortalRoute><MyProfile /></AdminPortalRoute>} />

                {/* ============ LEGACY ROUTES (kept for backward compat) ============ */}
                <Route path="/claimant" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "referring_attorney"]}><ClaimantForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/claimant-list" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "referring_attorney"]}><ClaimantList /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/claimant-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "view_reports", "referring_attorney"]}><ClaimantReports /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/referring-attorney" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney/:id" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-list" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyList /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-report" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_attorneys", "view_reports"]}><ReferringAttorneyReport /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-update" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyUpdate /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-profile" element={<ProtectedRoute><ReferringAttorneyProfile /></ProtectedRoute>} />
                
                <Route path="/appointment-request" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><AppointmentRequest /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/appointment-request-dashboard" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><AppointmentRequestDashboard /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/new-appointment" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><NewAppointment /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/scheduled-assessment" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><ScheduledAssessment /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/scheduled-assessments" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><ScheduledAssessment /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/appointment-checklist" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_appointments"><AppointmentChecklist /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/medical-expert" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-form" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertFormPage /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-form/:expertId" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertFormPage /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-directory" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertDirectory /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/recently-added-experts" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><RecentlyAddedExperts /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_experts", "view_reports"]}><ExpertReports /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-credit-control" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><ExpertCreditControl /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/report-tracking" element={<ProtectedRoute><PermissionProtectedRoute permission="view_reports"><ReportTracking /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/report-management" element={<ProtectedRoute><PermissionProtectedRoute permission="view_reports"><ReportManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-report-tracking" element={<ProtectedRoute><PermissionProtectedRoute permission="view_reports"><ExpertReportTrackingSystem /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/assessment-reports-statistics" element={<ProtectedRoute><PermissionProtectedRoute permission={["view_reports", "view_analytics"]}><AssessmentReportsStatistics /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/document-upload" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentUpload /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-uploading" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentUploading /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-proofreading" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentProofreading /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-checklist" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentChecklist /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-management" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-payment-tracking/:documentId" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODPaymentTracking /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-balance-summary" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODBalanceSummary /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/debtors-control" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_attorneys", "manage_documents"]}><ReferringAttorneyDebtorsControl /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/deleted-appointments" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><DeletedAppointments /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/case-management-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><CaseManagementReports /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/sample-reports" element={<ProtectedRoute><SampleReports /></ProtectedRoute>} />
                
                <Route path="/user-management" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><UserManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/permission-management" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><PermissionManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/security-settings" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><SecuritySettings /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/email-queue" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><EmailQueue /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/workflow-automation" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "admin_only"]}><WorkflowAutomation /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/edit-requests" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><EditRequestManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/audit-trail" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><AuditTrail /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/attorney-pitchlog" element={<ProtectedRoute><PermissionProtectedRoute permission={["admin_only", "attorney_pitchlog"]}><AttorneyPitchlog /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/attorney-referral-intelligence" element={<ProtectedRoute><PermissionProtectedRoute permission={["admin_only", "view_analytics"]}><AttorneyReferralIntelligence /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Sales Incentive Routes */}
                <Route path="/sales-dashboard" element={<ProtectedRoute><div className="min-h-screen bg-background"><div className="container mx-auto p-4 md:p-6"><SalesDashboard /></div></div></ProtectedRoute>} />

                {/* National Availability Heatmap — accessible to all authenticated users (incl. sales consultants & non-consultants) */}
                <Route path="/availability-heatmap" element={<ProtectedRoute><div className="min-h-screen bg-background"><div className="container mx-auto p-4 md:p-6"><AdminHeatmap /></div></div></ProtectedRoute>} />

                {/* Attorney Portal Routes */}
                <Route path="/attorney-portal" element={<ProtectedRoute><AttorneyPortalDashboard /></ProtectedRoute>} />
                <Route path="/attorney-portal/cases" element={<ProtectedRoute><AttorneyMyCases /></ProtectedRoute>} />
                <Route path="/attorney-portal/case-status" element={<ProtectedRoute><AttorneyCaseStatus /></ProtectedRoute>} />
                <Route path="/attorney-portal/appointments" element={<ProtectedRoute><AttorneyAppointments /></ProtectedRoute>} />
                <Route path="/attorney-portal/reports" element={<ProtectedRoute><AttorneyReports /></ProtectedRoute>} />
                <Route path="/attorney-portal/payments" element={<ProtectedRoute><AttorneyPayments /></ProtectedRoute>} />
                <Route path="/attorney-portal/agreements" element={<ProtectedRoute><AttorneyAgreements /></ProtectedRoute>} />
                <Route path="/attorney-portal/notifications" element={<ProtectedRoute><AttorneyNotifications /></ProtectedRoute>} />
                <Route path="/attorney-portal/support" element={<ProtectedRoute><AttorneySupport /></ProtectedRoute>} />
                
                {/* ============ EXPERT PORTAL ============ */}
                <Route path="/expert-portal" element={<ExpertPortalRoute><ExpertDashboard /></ExpertPortalRoute>} />
                <Route path="/expert-portal/cases" element={<ExpertPortalRoute><ExpertCases /></ExpertPortalRoute>} />
                <Route path="/expert-portal/case/:appointmentId" element={<ExpertPortalRoute><ExpertCaseDetail /></ExpertPortalRoute>} />
                <Route path="/expert-portal/schedule" element={<ExpertPortalRoute><ExpertSchedule /></ExpertPortalRoute>} />
                <Route path="/expert-portal/reports" element={<ExpertPortalRoute><ExpertReportTracking /></ExpertPortalRoute>} />
                <Route path="/expert-portal/performance" element={<ExpertPortalRoute><ExpertPerformance /></ExpertPortalRoute>} />
                <Route path="/expert-portal/profile" element={<ExpertPortalRoute><ExpertProfile /></ExpertPortalRoute>} />

                <Route path="/health" element={<Health />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
            </ConfirmDialogProvider>
          </AppointmentSyncProvider>
        </SecurityProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
  </GlobalErrorBoundary>
);

export default App;
