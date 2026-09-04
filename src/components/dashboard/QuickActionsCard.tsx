import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AdminCard, AdminCardHeader, AdminCardBody } from "@/components/admin/ui/AdminUI";
import { BarChart3, Calendar, FileText, Users } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const QuickActionsCard = () => (
  <AdminCard>
    <AdminCardHeader
      icon={BarChart3}
      title="Quick Actions"
      description="Most commonly used features for easy access"
    />
    <AdminCardBody>
      <div className="space-y-2">
        <PermissionGuard permission="manage_claimants" fallback={null}>
          <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-none">
            <Link to="/claimant" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Add New Claimant
            </Link>
          </Button>
        </PermissionGuard>
        <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-none">
          <Link to="/appointment-request" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Request Assessment
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-none">
          <Link to="/claimant-reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            View Reports
          </Link>
        </Button>
      </div>
    </AdminCardBody>
  </AdminCard>
);

export default QuickActionsCard;
