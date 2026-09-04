import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AdminCard, AdminCardHeader, AdminCardBody } from "@/components/admin/ui/AdminUI";
import { FileText, Settings, Users } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const HelpSupportCard = () => (
  <AdminCard>
    <AdminCardHeader
      icon={Settings}
      title="Help & Support"
      description="System resources and documentation"
    />
    <AdminCardBody>
      <div className="space-y-2">
        <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-none">
          <Link to="/sample-reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sample Reports
          </Link>
        </Button>
        <PermissionGuard permission="admin_only" fallback={null}>
          <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-none">
            <Link to="/user-management" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </Link>
          </Button>
        </PermissionGuard>
      </div>
    </AdminCardBody>
  </AdminCard>
);

export default HelpSupportCard;
