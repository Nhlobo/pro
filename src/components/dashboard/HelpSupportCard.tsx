import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Settings, Users } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const HelpSupportCard = () => (
  <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Settings className="h-5 w-5 text-kutlwano-gold" />
        Help & Support
      </CardTitle>
      <CardDescription>System resources and documentation</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link to="/sample-reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sample Reports
          </Link>
        </Button>
        <PermissionGuard permission="admin_only" fallback={null}>
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link to="/user-management" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </Link>
          </Button>
        </PermissionGuard>
      </div>
    </CardContent>
  </Card>
);

export default HelpSupportCard;
