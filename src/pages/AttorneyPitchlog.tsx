import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Plus, Edit, Trash2, UserCheck, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttorneys, Attorney } from "@/hooks/useAttorneys";
import { usePitchLogs } from "@/hooks/usePitchLogs";
import type { PitchLog } from "@/hooks/usePitchLogs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import { Helmet } from "react-helmet-async";

const AttorneyPitchlog = () => {
  const { attorneyId } = useParams<{ attorneyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateAttorneyStatus } = useAttorneys();
  const { pitchLogs, createPitchLog, fetchPitchLogs } = usePitchLogs(attorneyId);
  
  const [attorney, setAttorney] = useState<Attorney | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewPitchForm, setShowNewPitchForm] = useState(false);
  
  // Form state
  const [pitchDate, setPitchDate] = useState<Date>(new Date());
  const [pitchNotes, setPitchNotes] = useState("");
  const [feedbackComments, setFeedbackComments] = useState("");
  const [followUpReminder, setFollowUpReminder] = useState<Date | undefined>();

  useEffect(() => {
    const fetchAttorney = async () => {
      if (!attorneyId) return;
      
      try {
        const { data, error } = await supabase
          .from('attorneys')
          .select('*')
          .eq('id', attorneyId)
          .single();

        if (error) throw error;
        setAttorney(data as Attorney);
      } catch (err: any) {
        toast({
          title: "Error",
          description: "Failed to load attorney details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAttorney();
  }, [attorneyId]);

  const handleCreatePitchLog = async () => {
    if (!attorneyId || !attorney?.law_firm_id) return;

    try {
      await createPitchLog({
        attorney_id: attorneyId,
        pitch_date: format(pitchDate, 'yyyy-MM-dd'),
        pitch_notes: pitchNotes || null,
        feedback_comments: feedbackComments || null,
        follow_up_reminder: followUpReminder ? format(followUpReminder, 'yyyy-MM-dd') : null,
        law_firm_id: attorney.law_firm_id,
      });

      // Update attorney status to 'pitched' if it's still 'potential'
      if (attorney.status === 'potential') {
        await updateAttorneyStatus(attorneyId, 'pitched');
        setAttorney(prev => prev ? { ...prev, status: 'pitched' } : null);
      }

      // Reset form
      setPitchDate(new Date());
      setPitchNotes("");
      setFeedbackComments("");
      setFollowUpReminder(undefined);
      setShowNewPitchForm(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleStatusChange = async (newStatus: Attorney['status']) => {
    if (!attorneyId) return;
    
    await updateAttorneyStatus(attorneyId, newStatus);
    setAttorney(prev => prev ? { ...prev, status: newStatus } : null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'potential': return 'outline';
      case 'pitched': return 'secondary';
      case 'interested': return 'default';
      case 'closed': return 'default';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading attorney details...</p>
      </div>
    );
  }

  if (!attorney) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Attorney not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{attorney.name} - Pitchlog | CRM</title>
        <meta name="description" content={`Manage pitch logs and interactions with ${attorney.name}. Track communication history and lead progression.`} />
      </Helmet>

      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/crm')} 
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to CRM
            </Button>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{attorney.name}</h1>
                  {attorney.law_firm && (
                    <p className="text-muted-foreground mt-1">{attorney.law_firm}</p>
                  )}
                </div>
                <Badge variant={getStatusBadgeVariant(attorney.status)} className="text-lg px-3 py-1">
                  {attorney.status.charAt(0).toUpperCase() + attorney.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Attorney Details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Attorney Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {attorney.location && (
                  <div>
                    <Label className="text-sm font-medium">Location</Label>
                    <p className="text-sm text-muted-foreground">{attorney.location}</p>
                  </div>
                )}
                
                {attorney.specialization && attorney.specialization.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Specialization</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {attorney.specialization.map((spec, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {attorney.email && (
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{attorney.email}</p>
                  </div>
                )}

                {attorney.phone && (
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm text-muted-foreground">{attorney.phone}</p>
                  </div>
                )}

                {attorney.address && (
                  <div>
                    <Label className="text-sm font-medium">Address</Label>
                    <p className="text-sm text-muted-foreground">{attorney.address}</p>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  <Label className="text-sm font-medium">Update Status</Label>
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => handleStatusChange('interested')}
                      disabled={attorney.status === 'interested'}
                    >
                      <UserCheck className="h-4 w-4" />
                      Mark as Interested
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => handleStatusChange('closed')}
                      disabled={attorney.status === 'closed'}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Mark as Closed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pitch Logs */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Pitch History</h2>
              <Button 
                onClick={() => setShowNewPitchForm(!showNewPitchForm)} 
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Pitch Log
              </Button>
            </div>

            {/* New Pitch Form */}
            {showNewPitchForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>New Pitch Log</CardTitle>
                  <CardDescription>Record a new interaction with this attorney</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="pitch-date">Pitch Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !pitchDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {pitchDate ? format(pitchDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={pitchDate}
                          onSelect={(date) => date && setPitchDate(date)}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="pitch-notes">Pitch Notes</Label>
                    <Textarea
                      id="pitch-notes"
                      placeholder="Describe the pitch details..."
                      value={pitchNotes}
                      onChange={(e) => setPitchNotes(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="feedback">Feedback/Comments</Label>
                    <Textarea
                      id="feedback"
                      placeholder="Record attorney's feedback..."
                      value={feedbackComments}
                      onChange={(e) => setFeedbackComments(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="follow-up">Follow-up Reminder</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !followUpReminder && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {followUpReminder ? format(followUpReminder, "PPP") : <span>Set reminder date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={followUpReminder}
                          onSelect={setFollowUpReminder}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreatePitchLog}>Save Pitch Log</Button>
                    <Button variant="outline" onClick={() => setShowNewPitchForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing Pitch Logs */}
            <div className="space-y-4">
              {pitchLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pitch logs yet. Add your first interaction above.</p>
                  </CardContent>
                </Card>
              ) : (
                pitchLogs.map((log: PitchLog) => (
                  <Card key={log.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Pitch Log - {log.pitch_date}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {log.pitch_notes && (
                        <div>
                          <Label className="text-sm font-medium">Pitch Notes</Label>
                          <p className="text-sm text-muted-foreground mt-1">{log.pitch_notes}</p>
                        </div>
                      )}
                      
                      {log.feedback_comments && (
                        <div>
                          <Label className="text-sm font-medium">Feedback/Comments</Label>
                          <p className="text-sm text-muted-foreground mt-1">{log.feedback_comments}</p>
                        </div>
                      )}
                      
                      {log.follow_up_reminder && (
                        <div>
                          <Label className="text-sm font-medium">Follow-up Reminder</Label>
                          <p className="text-sm text-muted-foreground mt-1">{log.follow_up_reminder}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default AttorneyPitchlog;
