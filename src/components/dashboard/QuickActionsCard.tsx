import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calendar, FileText, Users } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const QuickActionsCard = () => (
  <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <BarChart3 className="h-5 w-5 text-kutlwano-blue" />
        Quick Actions
      </CardTitle>
      <CardDescription>Most commonly used features for easy access</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <PermissionGuard permission="manage_claimants" fallback={null}>
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link to="/claimant" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Add New Claimant
            </Link>
          </Button>
        </PermissionGuard>
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link to="/appointment-request" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Request Assessment
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link to="/claimant-reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            View Reports
          </Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default QuickActionsCard;
