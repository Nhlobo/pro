import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmailConfirmation from "./pages/EmailConfirmation";
import ReferringAttorneyForm from "./pages/ReferringAttorneyForm";
import ReferringAttorneyList from "./pages/ReferringAttorneyList";
import ReferringAttorneyReport from "./pages/ReferringAttorneyReport";
import ReferringAttorneyUpdate from "./pages/ReferringAttorneyUpdate";
import ClaimantForm from "./pages/ClaimantForm";
import ClaimantList from "./pages/ClaimantList";
import ClaimantReports from "./pages/ClaimantReports";
import MedicalExpertForm from "./pages/MedicalExpertForm";
import MedicalExpertDirectory from "./pages/MedicalExpertDirectory";
import ReportTracking from "./pages/ReportTracking";
import ExpertReports from "./pages/ExpertReports";
import LeadGenerator from "./pages/LeadGenerator";
import LeadHistory from "./pages/LeadHistory";
import UserManagement from "./pages/UserManagement";
import { EditRequestManagement } from "./pages/EditRequestManagement";
import AppointmentSchedule from "./pages/AppointmentSchedule";
import NewAppointment from "./pages/NewAppointment";
import ScheduledAssessment from "./pages/ScheduledAssessment";
import AssessmentReportsStatistics from "./pages/AssessmentReportsStatistics";
import DocumentUploading from "./pages/DocumentUploading";
import { AuditTrail } from "./pages/AuditTrail";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import { HelmetProvider } from "react-helmet-async";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/referring-attorney" element={<ProtectedRoute><ReferringAttorneyForm /></ProtectedRoute>} />
              <Route path="/referring-attorney-list" element={<ProtectedRoute><ReferringAttorneyList /></ProtectedRoute>} />
          <Route path="/referring-attorney-report" element={<ProtectedRoute><ReferringAttorneyReport /></ProtectedRoute>} />
          <Route path="/referring-attorney-update" element={<ProtectedRoute><ReferringAttorneyUpdate /></ProtectedRoute>} />
              <Route path="/claimant" element={<ProtectedRoute><ClaimantForm /></ProtectedRoute>} />
              <Route path="/claimant-list" element={<ProtectedRoute><ClaimantList /></ProtectedRoute>} />
              <Route path="/claimant-reports" element={<ProtectedRoute><ClaimantReports /></ProtectedRoute>} />
              <Route path="/medical-expert" element={<ProtectedRoute><MedicalExpertForm /></ProtectedRoute>} />
              <Route path="/medical-expert-directory" element={<ProtectedRoute><MedicalExpertDirectory /></ProtectedRoute>} />
              <Route path="/report-tracking" element={<ProtectedRoute><ReportTracking /></ProtectedRoute>} />
              <Route path="/expert-reports" element={<ProtectedRoute><ExpertReports /></ProtectedRoute>} />
              <Route path="/appointment-schedule" element={<ProtectedRoute><AppointmentSchedule /></ProtectedRoute>} />
              <Route path="/new-appointment" element={<ProtectedRoute><NewAppointment /></ProtectedRoute>} />
              <Route path="/scheduled-assessment" element={<ProtectedRoute><ScheduledAssessment /></ProtectedRoute>} />
              <Route path="/assessment-reports-statistics" element={<ProtectedRoute><AssessmentReportsStatistics /></ProtectedRoute>} />
              <Route path="/document-uploading" element={<ProtectedRoute><DocumentUploading /></ProtectedRoute>} />
              <Route path="/lead-generator" element={<ProtectedRoute><LeadGenerator /></ProtectedRoute>} />
              <Route path="/lead-history" element={<ProtectedRoute><LeadHistory /></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/edit-requests" element={<ProtectedRoute><EditRequestManagement /></ProtectedRoute>} />
              <Route path="/audit-trail" element={<ProtectedRoute><AuditTrail /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
