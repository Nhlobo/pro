
import React from "react";
import { Link } from "react-router-dom";
import { Calendar, FileText, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ReferringAttorneyDashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Attorney Dashboard</h1>
        <p className="text-muted-foreground">Manage your appointments and view reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Request New Appointment */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Request Appointment
            </CardTitle>
            <CardDescription>
              Submit new medical expert assessment requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/appointment-request">
                New Request
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Claimant Reports (View Only) */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Claimant Reports
            </CardTitle>
            <CardDescription>
              View your claimant assessment reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/claimant-reports">
                View Reports
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Attorney Report */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Attorney Report
            </CardTitle>
            <CardDescription>
              View your attorney performance report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/referring-attorney-report">
                View Report
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReferringAttorneyDashboard;
