import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Calendar, 
  ClipboardCheck, 
  UserCheck, 
  Edit3, 
  CheckCircle2, 
  Download,
  Search,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { LiveCaseStatus } from '@/hooks/useAttorneyDashboardStats';

interface LiveCaseTrackerProps {
  cases: LiveCaseStatus[];
  loading: boolean;
  onRefresh: () => void;
}

const phaseIcons: Record<string, React.ReactNode> = {
  'Referral Received': <FileText className="h-4 w-4" />,
  'Documents Verified': <ClipboardCheck className="h-4 w-4" />,
  'Appointment Scheduled': <Calendar className="h-4 w-4" />,
  'Claimant Assessed': <UserCheck className="h-4 w-4" />,
  'Report Drafting': <Edit3 className="h-4 w-4" />,
  'Quality Review': <CheckCircle2 className="h-4 w-4" />,
  'Report Ready': <Download className="h-4 w-4" />
};

const phaseColors: Record<string, string> = {
  'Referral Received': 'bg-kutlwano-blue',
  'Documents Verified': 'bg-kutlwano-teal',
  'Appointment Scheduled': 'bg-blue-500',
  'Claimant Assessed': 'bg-purple-500',
  'Report Drafting': 'bg-orange-500',
  'Quality Review': 'bg-amber-500',
  'Report Ready': 'bg-success'
};

export const LiveCaseTracker: React.FC<LiveCaseTrackerProps> = ({ cases, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const filteredCases = cases.filter(c => 
    c.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.claimantAutoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.expertType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: 'completed' | 'in_progress' | 'pending') => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30 text-xs">Done</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning/20 text-warning border-warning/30 text-xs animate-pulse">Active</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-xs">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Case Tracker...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-kutlwano-blue">
              <FileText className="h-5 w-5" />
              Live Case Tracker
            </CardTitle>
            <CardDescription>
              Real-time progress tracking for all your matters
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by claimant name, ID, or expert type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Timeline Legend */}
        <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/30 rounded-lg">
          {Object.entries(phaseIcons).map(([phase, icon]) => (
            <div key={phase} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`p-1 rounded ${phaseColors[phase]} text-white`}>
                {icon}
              </div>
              <span>{phase}</span>
            </div>
          ))}
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {filteredCases.map((caseItem) => (
              <Card 
                key={caseItem.id} 
                className={`bg-background/50 border-border/50 transition-all duration-300 hover:shadow-md cursor-pointer ${
                  expandedCase === caseItem.id ? 'ring-2 ring-kutlwano-blue/50' : ''
                }`}
                onClick={() => setExpandedCase(expandedCase === caseItem.id ? null : caseItem.id)}
              >
                <CardContent className="p-4">
                  {/* Case Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-semibold text-foreground">{caseItem.claimantName}</div>
                      <div className="text-sm text-muted-foreground">
                        {caseItem.claimantAutoId} • {caseItem.expertType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${phaseColors[caseItem.currentPhase]} text-white`}>
                        {caseItem.currentPhase}
                      </Badge>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedCase === caseItem.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                  </div>

                  {/* Timeline Progress Bar */}
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      {caseItem.phases.map((phase, index) => (
                        <div 
                          key={phase.name} 
                          className="flex flex-col items-center relative z-10"
                          style={{ width: `${100 / caseItem.phases.length}%` }}
                        >
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                              phase.status === 'completed' 
                                ? `${phaseColors[phase.name]} text-white shadow-lg` 
                                : phase.status === 'in_progress'
                                  ? `${phaseColors[phase.name]} text-white animate-pulse shadow-lg ring-4 ring-offset-2 ring-offset-background ring-${phaseColors[phase.name]}/30`
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {phaseIcons[phase.name]}
                          </div>
                          {index < caseItem.phases.length - 1 && (
                            <div 
                              className={`absolute top-4 left-[calc(50%+16px)] h-0.5 transition-all duration-300 ${
                                phase.status === 'completed' ? 'bg-success' : 'bg-muted'
                              }`}
                              style={{ width: 'calc(100% - 32px)' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCase === caseItem.id && (
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Appointment Date</div>
                          <div className="font-medium">
                            {caseItem.appointmentDate 
                              ? format(new Date(caseItem.appointmentDate), 'MMM dd, yyyy')
                              : 'Not scheduled'
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Current Stage</div>
                          <div className="font-medium">{caseItem.currentPhase}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Progress</div>
                          <div className="font-medium">
                            {caseItem.phases.filter(p => p.status === 'completed').length} / {caseItem.phases.length} steps
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Expert Type</div>
                          <div className="font-medium">{caseItem.expertType}</div>
                        </div>
                      </div>

                      {/* Detailed Phase List */}
                      <div className="space-y-2">
                        {caseItem.phases.map((phase, index) => (
                          <div 
                            key={phase.name}
                            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                              phase.status === 'in_progress' ? 'bg-warning/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                phase.status === 'completed' 
                                  ? 'bg-success text-white' 
                                  : phase.status === 'in_progress'
                                    ? 'bg-warning text-white'
                                    : 'bg-muted text-muted-foreground'
                              }`}>
                                {index + 1}
                              </div>
                              <span className={phase.status === 'pending' ? 'text-muted-foreground' : ''}>
                                {phase.name}
                              </span>
                            </div>
                            {getStatusBadge(phase.status)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredCases.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Cases Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms' : 'No active cases to display'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
