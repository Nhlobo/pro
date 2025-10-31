import { useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Circle, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCaseTimeline, TimelinePhase } from "@/hooks/useCaseTimeline";
import { cn } from "@/lib/utils";

interface CaseTimelineProps {
  appointmentId: string;
  claimantName?: string;
  expertName?: string;
}

export const CaseTimeline = ({ appointmentId, claimantName, expertName }: CaseTimelineProps) => {
  const { timeline, loading, updatePhaseNotes } = useCaseTimeline(appointmentId);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const getPhaseIcon = (phase: TimelinePhase) => {
    switch (phase.status) {
      case 'completed':
        return <Check className="h-5 w-5 text-success" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-primary animate-pulse" />;
      default:
        return <Circle className="h-5 w-5 text-muted" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-primary">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const calculateDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return null;
    
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    return days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : 'Same day';
  };

  const handleSaveNotes = async (phaseId: string) => {
    await updatePhaseNotes(phaseId, notesValue);
    setEditingNotes(null);
    setNotesValue("");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case Timeline</CardTitle>
          <CardDescription>
            Timeline will be created automatically when appointment is scheduled
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case Timeline</CardTitle>
        {(claimantName || expertName) && (
          <CardDescription>
            {claimantName && `Claimant: ${claimantName}`}
            {claimantName && expertName && ' • '}
            {expertName && `Expert: ${expertName}`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          {/* Timeline items */}
          <div className="space-y-6">
            {timeline.map((phase, index) => (
              <div key={phase.id} className="relative pl-14">
                {/* Icon */}
                <div className="absolute left-3 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2 border-border">
                  {getPhaseIcon(phase)}
                </div>
                
                {/* Content */}
                <div className={cn(
                  "space-y-2 pb-6",
                  index === timeline.length - 1 && "pb-0"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {phase.phase_name}
                      </h3>
                      {getStatusBadge(phase.status)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPhase(
                        expandedPhase === phase.id ? null : phase.id
                      )}
                    >
                      {expandedPhase === phase.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Dates */}
                  <div className="text-sm text-muted-foreground space-y-1">
                    {phase.started_at && (
                      <div>
                        Started: {format(new Date(phase.started_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    )}
                    {phase.completed_at && (
                      <div>
                        Completed: {format(new Date(phase.completed_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    )}
                    {phase.started_at && phase.completed_at && (
                      <div className="text-xs font-medium text-primary">
                        Duration: {calculateDuration(phase.started_at, phase.completed_at)}
                      </div>
                    )}
                  </div>
                  
                  {/* Expanded details */}
                  {expandedPhase === phase.id && (
                    <div className="mt-3 space-y-3 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Notes</h4>
                        {editingNotes !== phase.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingNotes(phase.id);
                              setNotesValue(phase.notes || "");
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                      
                      {editingNotes === phase.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Add notes about this phase..."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveNotes(phase.id)}
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingNotes(null);
                                setNotesValue("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {phase.notes || "No notes added yet"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
