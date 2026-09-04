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

const BRAND_TEAL = "#00BAAD";

/** Flat, uniform tile — same visual language as AdminCard: white surface,
 *  hairline border, teal icon accent. Replaces the old per-category
 *  rainbow-gradient buttons so this grid reads consistently with every
 *  other screen in the system (Attorney Pitchlog, Sales Dashboard,
 *  Claimant/Attorney Management, etc). */
const menuTileClass =
  "min-h-20 h-auto flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-none border border-black/10 bg-white text-black hover:bg-black/[0.03] hover:border-black/25 transition-colors duration-150 shadow-none";

const DashboardMenus = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
    <PermissionGuard permission="manage_claimants" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <Users className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Claimant Management</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/claimant" className="flex items-center w-full">Add New Claimant</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/claimant-list" className="flex items-center w-full">View All Claimants</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_attorneys" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <UserCheck className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Attorney Management</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney" className="flex items-center w-full">Add New Attorney</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-list" className="flex items-center w-full">View All Attorneys</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-update" className="flex items-center w-full">Assessment Update</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_experts" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <Stethoscope className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Medical Experts</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/medical-expert" className="flex items-center w-full">Add Medical Expert</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/medical-expert-directory" className="flex items-center w-full">Expert Directory</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/expert-credit-control" className="flex items-center w-full">Credit Control</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="view_reports" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <FileText className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Assessment & Reports</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/report-tracking" className="flex items-center w-full">Report Tracking</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/sample-reports" className="flex items-center w-full">Sample Reports</Link>
          </DropdownMenuItem>
          <PermissionGuard permission="admin_only" showAlert={false}>
            <DropdownMenuItem asChild>
              <Link to="/assessment-reports-statistics" className="flex items-center w-full">Assessment Statistics</Link>
            </DropdownMenuItem>
          </PermissionGuard>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_appointments" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <Calendar className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Appointments</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/appointment-request-dashboard" className="flex items-center w-full">Request Dashboard</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/scheduled-assessment" className="flex items-center w-full">Scheduled Assessments</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/new-appointment" className="flex items-center w-full">New Appointment</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/appointment-checklist" className="flex items-center w-full">Appointment Checklist</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin/litigation-requests" className="flex items-center w-full">
              <FileSignature className="h-4 w-4 mr-2" />
              Litigation Service Requests
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="manage_documents" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <Upload className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Document Management</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/document-uploading" className="flex items-center w-full">
              <Upload className="h-4 w-4 mr-2" />
              Document Upload
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/document-proofreading" className="flex items-center w-full">
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
          <Button variant="outline" className={menuTileClass}>
            <FileSignature className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">Case Management</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/appointment-request" className="flex items-center w-full">Request Appointment</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/claimant-reports" className="flex items-center w-full">Claimant Progress Report</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/referring-attorney-update" className="flex items-center w-full">Assessment Update</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/aod-management" className="flex items-center w-full">AOD Management</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/debtors-control" className="flex items-center w-full">Debtors Control</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/case-management-reports" className="flex items-center w-full">Case Reports</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>

    <PermissionGuard permission="attorney_pitchlog" showAlert={false}>
      <Button asChild variant="outline" className={menuTileClass}>
        <Link to="/attorney-pitchlog">
          <Target className="h-6 w-6" style={{ color: BRAND_TEAL }} />
          <span className="text-xs sm:text-sm font-medium text-center leading-tight">Attorney Pitchlog</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="manage_appointments" showAlert={false}>
      <Button asChild variant="outline" className={menuTileClass}>
        <Link to="/workflow-automation">
          <Zap className="h-6 w-6" style={{ color: BRAND_TEAL }} />
          <span className="text-xs sm:text-sm font-medium text-center leading-tight">Workflow Hub</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="view_analytics" showAlert={false}>
      <Button asChild variant="outline" className={menuTileClass}>
        <Link to="/attorney-referral-intelligence">
          <BarChart3 className="h-6 w-6" style={{ color: BRAND_TEAL }} />
          <span className="text-xs sm:text-sm font-medium text-center leading-tight">Referral Intelligence</span>
        </Link>
      </Button>
    </PermissionGuard>

    <PermissionGuard permission="system_admin" showAlert={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={menuTileClass}>
            <Settings className="h-6 w-6" style={{ color: BRAND_TEAL }} />
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">System Admin</span>
            <ChevronDown className="h-4 w-4 text-black/40" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none border-black/10 bg-white shadow-none">
          <DropdownMenuItem asChild>
            <Link to="/user-management" className="flex items-center w-full">User Management</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/edit-requests" className="flex items-center w-full">Edit Requests</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/audit-trail" className="flex items-center w-full">Audit Trail</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </PermissionGuard>
  </div>
);

export default DashboardMenus;
