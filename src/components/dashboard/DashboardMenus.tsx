import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  FileSignature,
  FileText,
  Settings,
  Stethoscope,
  Target,
  Upload,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const DashboardMenus = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
    <PermissionGuard permission="manage_claimants" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-kutlwano-blue text-white border-kutlwano-blue hover:bg-kutlwano-blue/90 hover:scale-105 transition-all duration-300 shadow-md">
            <Users className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Claimant Management</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/claimant" className="flex items-center w-full hover:bg-kutlwano-blue/10">Add New Claimant</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/claimant-list" className="flex items-center w-full hover:bg-kutlwano-blue/10">View All Claimants</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_attorneys" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:scale-105 transition-all duration-300 shadow-md">
            <UserCheck className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Attorney Management</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney" className="flex items-center w-full hover:bg-kutlwano-gold/10">Add New Attorney</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-list" className="flex items-center w-full hover:bg-kutlwano-gold/10">View All Attorneys</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-update" className="flex items-center w-full hover:bg-kutlwano-gold/10">Assessment Update</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_experts" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-kutlwano-teal text-white border-kutlwano-teal hover:bg-kutlwano-teal/90 hover:scale-105 transition-all duration-300 shadow-md">
            <Stethoscope className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Medical Experts</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/medical-expert" className="flex items-center w-full hover:bg-kutlwano-teal/10">Add Medical Expert</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/medical-expert-directory" className="flex items-center w-full hover:bg-kutlwano-teal/10">Expert Directory</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/expert-credit-control" className="flex items-center w-full hover:bg-kutlwano-teal/10">Credit Control</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="view_reports" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:scale-105 transition-all duration-300 shadow-md">
            <FileText className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Assessment & Reports</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/report-tracking" className="flex items-center w-full hover:bg-emerald-500/10">Report Tracking</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/sample-reports" className="flex items-center w-full hover:bg-emerald-500/10">Sample Reports</Link>
          </DropdownMenuItem>
          <PermissionGuard permission="admin_only" showAlert={false}>
            <DropdownMenuItem asChild>
              <Link to="/assessment-reports-statistics" className="flex items-center w-full hover:bg-emerald-500/10">Assessment Statistics</Link>
            </DropdownMenuItem>
          </PermissionGuard>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_appointments" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-violet-500 text-white border-violet-500 hover:bg-violet-600 hover:scale-105 transition-all duration-300 shadow-md">
            <Calendar className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Appointments</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/appointment-request-dashboard" className="flex items-center w-full hover:bg-violet-500/10">Request Dashboard</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/scheduled-assessment" className="flex items-center w-full hover:bg-violet-500/10">Scheduled Assessments</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/new-appointment" className="flex items-center w-full hover:bg-violet-500/10">New Appointment</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/appointment-checklist" className="flex items-center w-full hover:bg-violet-500/10">Appointment Checklist</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_documents" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:scale-105 transition-all duration-300 shadow-md">
            <Upload className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Document Management</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/document-uploading" className="flex items-center w-full hover:bg-orange-500/10">
              <Upload className="h-4 w-4 mr-2" />
              Document Upload
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/document-proofreading" className="flex items-center w-full hover:bg-orange-500/10">
              <FileText className="h-4 w-4 mr-2" />
              Document Proofreading
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="case_management" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:scale-105 transition-all duration-300 shadow-md">
            <FileSignature className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">Case Management</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/appointment-request" className="flex items-center w-full hover:bg-blue-500/10">Request Appointment</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/claimant-reports" className="flex items-center w-full hover:bg-blue-500/10">Claimant Progress Report</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-update" className="flex items-center w-full hover:bg-blue-500/10">Assessment Update</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/aod-management" className="flex items-center w-full hover:bg-blue-500/10">AOD Management</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/debtors-control" className="flex items-center w-full hover:bg-blue-500/10">Debtors Control</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/case-management-reports" className="flex items-center w-full hover:bg-blue-500/10">Case Reports</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="attorney_pitchlog" showAlert={false}>
      <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
        <Link to="/attorney-pitchlog">
          <Target className="h-6 w-6 text-white" />
          <span className="text-sm font-medium">Attorney Pitchlog</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="manage_appointments" showAlert={false}>
      <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-kutlwano-blue to-kutlwano-teal text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
        <Link to="/workflow-automation">
          <Zap className="h-6 w-6 text-white" />
          <span className="text-sm font-medium">Workflow Hub</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="view_analytics" showAlert={false}>
      <Button asChild className="h-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-600 to-teal-600 text-white hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-md">
        <Link to="/attorney-referral-intelligence">
          <BarChart3 className="h-6 w-6 text-white" />
          <span className="text-sm font-medium">Referral Intelligence</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="system_admin" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 bg-red-500 text-white border-red-500 hover:bg-red-600 hover:scale-105 transition-all duration-300 shadow-md">
            <Settings className="h-6 w-6 text-white" />
            <span className="text-sm font-medium">System Admin</span>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card shadow-elegant border-border/50">
          <DropdownMenuItem asChild>
            <Link to="/user-management" className="flex items-center w-full hover:bg-red-500/10">User Management</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/edit-requests" className="flex items-center w-full hover:bg-red-500/10">Edit Requests</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/audit-trail" className="flex items-center w-full hover:bg-red-500/10">Audit Trail</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>
  </div>
);

export default DashboardMenus;
