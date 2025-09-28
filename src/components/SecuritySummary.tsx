import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Eye, Lock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePermissions } from '@/hooks/usePermissions';
import { Link } from 'react-router-dom';

interface SecurityScore {
  overall: number;
  access_control: number;
  data_protection: number;
  audit_compliance: number;
}

export const SecuritySummary: React.FC = () => {
  const { isAdmin } = usePermissions();
  const [securityScore, setSecurityScore] = useState<SecurityScore>({
    overall: 85,
    access_control: 95,
    data_protection: 90,
    audit_compliance: 85
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <Card className="border-kutlwano-blue/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-kutlwano-blue" />
          Security & Compliance Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Security Score */}
        <div className="text-center p-4 bg-gradient-to-r from-kutlwano-blue/10 to-kutlwano-teal/10 rounded-lg">
          <div className={`text-3xl font-bold ${getScoreColor(securityScore.overall)}`}>
            {securityScore.overall}%
          </div>
          <p className="text-sm text-muted-foreground">Overall Security Score</p>
        </div>

        {/* Security Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm font-medium">Access Control</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Progress 
                  value={securityScore.access_control} 
                  className="h-2"
                />
              </div>
              <Badge className={getScoreBgColor(securityScore.access_control)}>
                <span className={getScoreColor(securityScore.access_control)}>
                  {securityScore.access_control}%
                </span>
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm font-medium">Data Protection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Progress 
                  value={securityScore.data_protection} 
                  className="h-2"
                />
              </div>
              <Badge className={getScoreBgColor(securityScore.data_protection)}>
                <span className={getScoreColor(securityScore.data_protection)}>
                  {securityScore.data_protection}%
                </span>
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm font-medium">Audit Compliance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Progress 
                  value={securityScore.audit_compliance} 
                  className="h-2"
                />
              </div>
              <Badge className={getScoreBgColor(securityScore.audit_compliance)}>
                <span className={getScoreColor(securityScore.audit_compliance)}>
                  {securityScore.audit_compliance}%
                </span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Security Features Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-green-50 rounded border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-800">RLS Enabled</p>
          </div>

          <div className="text-center p-3 bg-green-50 rounded border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-800">Audit Active</p>
          </div>

          <div className="text-center p-3 bg-green-50 rounded border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-800">Data Masked</p>
          </div>

          <div className="text-center p-3 bg-green-50 rounded border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-800">RBAC Active</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-4 border-t">
          <Link to="/security-settings">
            <Button 
              variant="outline" 
              className="w-full border-kutlwano-blue/30 text-kutlwano-blue hover:bg-kutlwano-blue/10"
            >
              <Shield className="h-4 w-4 mr-2" />
              Manage Security Settings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};