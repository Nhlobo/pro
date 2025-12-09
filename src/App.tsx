import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SecurityProvider } from "@/components/SecurityProvider";
import { AppointmentSyncProvider } from "@/contexts/AppointmentSyncContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmailConfirmation from "./pages/EmailConfirmation";
import ReferringAttorneyForm from "./pages/ReferringAttorneyForm";
import ReferringAttorneyList from "./pages/ReferringAttorneyList";
import ReferringAttorneyReport from "./pages/ReferringAttorneyReport";
import ReferringAttorneyUpdate from "./pages/ReferringAttorneyUpdate";
import ReferringAttorneyProfile from "./pages/ReferringAttorneyProfile";
import AppointmentRequest from "./pages/AppointmentRequest";
import AppointmentRequestDashboard from "./pages/AppointmentRequestDashboard";
import ClaimantForm from "./pages/ClaimantForm";
import ClaimantList from "./pages/ClaimantList";
import ClaimantReports from "./pages/ClaimantReports";
import MedicalExpertForm from "./pages/MedicalExpertForm";
import MedicalExpertFormPage from "./pages/MedicalExpertFormPage";
import MedicalExpertDirectory from "./pages/MedicalExpertDirectory";
import RecentlyAddedExperts from "./pages/RecentlyAddedExperts";

import ReportTracking from "./pages/ReportTracking";
import ExpertReports from "./pages/ExpertReports";
import ExpertReportTrackingSystem from "./pages/ExpertReportTrackingSystem";
import ExpertCreditControl from "./pages/ExpertCreditControl";
import UserManagement from "./pages/UserManagement";
import { EditRequestManagement } from "./pages/EditRequestManagement";
import NewAppointment from "./pages/NewAppointment";
import ScheduledAssessment from "./pages/ScheduledAssessment";
import AssessmentReportsStatistics from "./pages/AssessmentReportsStatistics";
import DocumentUpload from "./pages/DocumentUpload";
import DocumentUploading from "./pages/DocumentUploading";
import DocumentProofreading from "./pages/DocumentProofreading";
import DocumentChecklist from "./pages/DocumentChecklist";
import SampleReports from "./pages/SampleReports";
import AODManagement from "./pages/AODManagement";
import AODPaymentTracking from "./pages/AODPaymentTracking";
import AODBalanceSummary from "./pages/AODBalanceSummary";
import ReferringAttorneyDebts from "./pages/ReferringAttorneyDebts";
import DeletedAppointments from "./pages/DeletedAppointments";
import CaseManagementReports from "./pages/CaseManagementReports";
import { AuditTrail } from "./pages/AuditTrail";
import PermissionManagement from "./pages/PermissionManagement";
import SecuritySettings from "./pages/SecuritySettings";
import EmailQueue from "./pages/EmailQueue";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionProtectedRoute from "./components/PermissionProtectedRoute";
import { HelmetProvider } from "react-helmet-async";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SecurityProvider>
            <AppointmentSyncProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/email-confirmation" element={<EmailConfirmation />} />
                <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                
                {/* Claimant Management - Accessible to referring attorneys and users with manage_claimants */}
                <Route path="/claimant" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "referring_attorney"]}><ClaimantForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/claimant-list" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "referring_attorney"]}><ClaimantList /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/claimant-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_claimants", "view_reports", "referring_attorney"]}><ClaimantReports /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Attorney Management */}
                <Route path="/referring-attorney" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney/:id" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-list" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyList /></PermissionProtectedRoute></ProtectedRoute>} />
                
                <Route path="/referring-attorney-report" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_attorneys", "view_reports"]}><ReferringAttorneyReport /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-update" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_attorneys"><ReferringAttorneyUpdate /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-profile" element={<ProtectedRoute><ReferringAttorneyProfile /></ProtectedRoute>} />
                
                {/* Appointment Management - Accessible to referring attorneys and users with manage_appointments */}
                <Route path="/appointment-request" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><AppointmentRequest /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/appointment-request-dashboard" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><AppointmentRequestDashboard /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/new-appointment" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><NewAppointment /></PermissionProtectedRoute></ProtectedRoute>} />
                 <Route path="/scheduled-assessment" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><ScheduledAssessment /></PermissionProtectedRoute></ProtectedRoute>} />
                 <Route path="/scheduled-assessments" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_appointments", "referring_attorney"]}><ScheduledAssessment /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Medical Expert Management */}
                <Route path="/medical-expert" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertForm /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-form" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertFormPage /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-form/:expertId" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertFormPage /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/medical-expert-directory" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><MedicalExpertDirectory /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/recently-added-experts" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><RecentlyAddedExperts /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_experts", "view_reports"]}><ExpertReports /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-credit-control" element={<ProtectedRoute><PermissionProtectedRoute permission="manage_experts"><ExpertCreditControl /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Reports and Analytics */}
                <Route path="/report-tracking" element={<ProtectedRoute><PermissionProtectedRoute permission="view_reports"><ReportTracking /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/expert-report-tracking" element={<ProtectedRoute><PermissionProtectedRoute permission="view_reports"><ExpertReportTrackingSystem /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/assessment-reports-statistics" element={<ProtectedRoute><PermissionProtectedRoute permission={["view_reports", "view_analytics"]}><AssessmentReportsStatistics /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Document Management - Accessible to referring attorneys and users with manage_documents */}
                <Route path="/document-upload" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentUpload /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-uploading" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentUploading /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-proofreading" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentProofreading /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/document-checklist" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><DocumentChecklist /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-management" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-payment-tracking/:documentId" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODPaymentTracking /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/aod-balance-summary" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><AODBalanceSummary /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/referring-attorney-debts" element={<ProtectedRoute><PermissionProtectedRoute permission="referring_attorney"><ReferringAttorneyDebts /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/deleted-appointments" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><DeletedAppointments /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/case-management-reports" element={<ProtectedRoute><PermissionProtectedRoute permission={["manage_documents", "referring_attorney"]}><CaseManagementReports /></PermissionProtectedRoute></ProtectedRoute>} />
                
                {/* Sample Reports - Available to all referring attorneys */}
                <Route path="/sample-reports" element={<ProtectedRoute><SampleReports /></ProtectedRoute>} />
                
                
                
                {/* Admin Only Routes */}
                <Route path="/user-management" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><UserManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/permission-management" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><PermissionManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/security-settings" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><SecuritySettings /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/email-queue" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><EmailQueue /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/edit-requests" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><EditRequestManagement /></PermissionProtectedRoute></ProtectedRoute>} />
                <Route path="/audit-trail" element={<ProtectedRoute><PermissionProtectedRoute permission="admin_only"><AuditTrail /></PermissionProtectedRoute></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AppointmentSyncProvider>
        </SecurityProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
</HelmetProvider>
);

export default App;
