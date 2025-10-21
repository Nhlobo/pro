import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, FileText, CheckCircle, XCircle, Clock, Calendar, Edit2, ExternalLink, Mail, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppointmentRequests } from "@/hooks/useAppointmentRequests";
import { format } from "date-fns";
import CompanyFooter from "@/components/CompanyFooter";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";
import { AppointmentRequestEmailDialog } from "@/components/AppointmentRequestEmailDialog";

const AppointmentRequestDashboard = () => {
  const { requests, loading, processRequest, deleteRequest } = useAppointmentRequests();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [processingNotes, setProcessingNotes] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [showDateProposal, setShowDateProposal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState("");
  const [confirmedTime, setConfirmedTime] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailRequest, setSelectedEmailRequest] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

  // Enable real-time notifications
  useAppointmentNotifications();

  const filteredRequests = requests.filter(request =>
    request.referring_attorney_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.claimant_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.claimant_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.expert_type_requested.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.province.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string, syncedAppointmentId?: string) => {
    const syncIndicator = syncedAppointmentId ? (
      <div className="flex items-center gap-1 mt-1">
        <ExternalLink className="w-3 h-3" />
        <span className="text-xs text-muted-foreground">Synced to Schedule</span>
      </div>
    ) : null;

    let badge;
    switch (status) {
      case "pending":
        badge = <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
        break;
      case "approved":
        badge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
        break;
      case "rejected":
        badge = <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
        break;
      case "new_date_proposed":
        badge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" />New Date Proposed</Badge>;
        break;
      default:
        badge = <Badge variant="secondary">{status}</Badge>;
    }

    return (
      <div>
        {badge}
        {syncIndicator}
      </div>
    );
  };

  const getMatterTypeBadge = (matterType: string) => {
    switch (matterType) {
      case "mva":
        return <Badge variant="default">MVA</Badge>;
      case "medical_negligence":
        return <Badge variant="secondary">Medical Negligence</Badge>;
      case "other_matters":
        return <Badge variant="outline">Other Matters</Badge>;
      default:
        return <Badge variant="secondary">{matterType}</Badge>;
    }
  };

  const handleProcessRequest = async (requestId: string, status: 'approved' | 'rejected' | 'new_date_proposed') => {
    const proposedDateValue = status === 'new_date_proposed' ? proposedDate : undefined;
    const proposedTimeValue = status === 'new_date_proposed' ? proposedTime : undefined;
    const confirmedAppointmentDate = status === 'approved' ? confirmedDate : undefined;
    const confirmedAppointmentTime = status === 'approved' ? confirmedTime : undefined;
    
    await processRequest(requestId, status, processingNotes, proposedDateValue, proposedTimeValue, confirmedAppointmentDate, confirmedAppointmentTime);
    resetDialog();
  };

  const resetDialog = () => {
    setSelectedRequest(null);
    setProcessingNotes("");
    setProposedDate("");
    setProposedTime("");
    setConfirmedDate("");
    setConfirmedTime("");
    setShowDateProposal(false);
    setShowConfirmation(false);
    setIsEditMode(false);
  };

  const handleEditRequest = (request: any) => {
    setSelectedRequest(request);
    setIsEditMode(true);
    
    // Pre-populate fields based on current status
    if (request.status === 'approved' && request.confirmed_appointment_date) {
      const date = new Date(request.confirmed_appointment_date);
      setConfirmedDate(date.toISOString().split('T')[0]);
      setConfirmedTime(date.toTimeString().slice(0, 5));
      setShowConfirmation(true);
    } else if (request.status === 'new_date_proposed' && request.suggested_date) {
      const date = new Date(request.suggested_date);
      setProposedDate(date.toISOString().split('T')[0]);
      if (request.suggested_date.includes('T')) {
        setProposedTime(date.toTimeString().slice(0, 5));
      }
      setShowDateProposal(true);
    }
    
    if (request.approval_notes) {
      setProcessingNotes(request.approval_notes);
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/appointment-request-dashboard';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Appointment Request Dashboard - Medico-Legal Assessment System</title>
        <meta name="description" content="Internal dashboard to manage appointment requests from attorneys. Review, approve, and track all incoming requests." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Appointment Request Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBadge />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Appointment Requests
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by attorney, claimant, expert type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Attorney/Firm</TableHead>
                    <TableHead>Claimant</TableHead>
                    <TableHead>Expert Type</TableHead>
                    <TableHead>Matter Type</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading requests...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {format(new Date(request.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.referring_attorney_name}
                        </TableCell>
                        <TableCell>
                          {request.claimant_first_name} {request.claimant_last_name}
                          {request.is_minor && (
                            <Badge variant="outline" className="ml-2 text-xs">Minor</Badge>
                          )}
                        </TableCell>
                        <TableCell>{request.expert_type_requested}</TableCell>
                        <TableCell>{getMatterTypeBadge(request.matter_type)}</TableCell>
                        <TableCell>{request.province}</TableCell>
                        <TableCell>{getStatusBadge(request.status, request.synced_appointment_id)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEmailRequest(request);
                                setEmailDialogOpen(true);
                              }}
                              title="Send Email Update"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRequestToDelete(request.id);
                                setDeleteDialogOpen(true);
                              }}
                              title="Delete Request"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Dialog open={selectedRequest?.id === request.id} onOpenChange={(open) => !open && resetDialog()}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setIsEditMode(false);
                                  }}
                                >
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    {isEditMode ? 'Edit Appointment Request' : 'Review Appointment Request'}
                                  </DialogTitle>
                                </DialogHeader>
                              {selectedRequest && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-semibold">Attorney/Firm</h4>
                                      <p>{selectedRequest.referring_attorney_name}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold">Claimant</h4>
                                      <p>{selectedRequest.claimant_first_name} {selectedRequest.claimant_last_name}</p>
                                      {selectedRequest.is_minor && selectedRequest.guardian_name && (
                                        <p className="text-sm text-muted-foreground">Guardian: {selectedRequest.guardian_name}</p>
                                      )}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold">Expert Type</h4>
                                      <p>{selectedRequest.expert_type_requested}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold">Matter Type</h4>
                                      <p>{selectedRequest.matter_type}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold">Province</h4>
                                      <p>{selectedRequest.province}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold">Date Preference</h4>
                                      <p>{selectedRequest.preferred_date_type}</p>
                                      {selectedRequest.suggested_date && (
                                        <p className="text-sm">Suggested: {selectedRequest.suggested_date}</p>
                                      )}
                                      {selectedRequest.suggested_month && (
                                        <p className="text-sm">Month: {selectedRequest.suggested_month}</p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {selectedRequest.special_requests && selectedRequest.special_requests.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold">Special Requests</h4>
                                      <div className="flex gap-2 flex-wrap">
                                        {selectedRequest.special_requests.map((req: string, index: number) => (
                                          <Badge key={index} variant="outline">{req}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                   {selectedRequest.additional_notes && (
                                     <div>
                                       <h4 className="font-semibold">Additional Notes</h4>
                                       <p className="text-sm bg-muted p-3 rounded">{selectedRequest.additional_notes}</p>
                                     </div>
                                   )}

                                   {/* Show current status information in edit mode */}
                                   {isEditMode && (
                                     <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                       <h4 className="font-semibold text-blue-900 mb-2">Current Status Information</h4>
                                       <div className="space-y-2 text-sm">
                                         <div>
                                           <span className="font-medium">Status:</span> {getStatusBadge(selectedRequest.status, selectedRequest.synced_appointment_id)}
                                         </div>
                                         {selectedRequest.status === 'approved' && selectedRequest.confirmed_appointment_date && (
                                           <div>
                                             <span className="font-medium">Current Confirmed Date:</span>{' '}
                                             {format(new Date(selectedRequest.confirmed_appointment_date), 'PPP p')}
                                           </div>
                                         )}
                                          {selectedRequest.status === 'new_date_proposed' && selectedRequest.suggested_date && (
                                            <div>
                                              <span className="font-medium">Current Proposed Date:</span>{' '}
                                              {selectedRequest.suggested_date.includes('T') 
                                                ? format(new Date(selectedRequest.suggested_date), 'PPP p')
                                                : format(new Date(selectedRequest.suggested_date), 'PPP')
                                              }
                                            </div>
                                          )}
                                         {selectedRequest.approval_notes && (
                                           <div>
                                             <span className="font-medium">Previous Notes:</span> {selectedRequest.approval_notes}
                                           </div>
                                         )}
                                         {selectedRequest.synced_appointment_id && (
                                           <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                             <div className="flex items-center gap-2">
                                               <ExternalLink className="w-4 h-4 text-green-600" />
                                               <span className="font-medium text-green-800">Synced to Scheduled Assessments</span>
                                             </div>
                                             <p className="text-sm text-green-700 mt-1">
                                               This request has been automatically synced to the Scheduled Assessment system.
                                             </p>
                                             <Link to="/scheduled-assessment" className="inline-flex items-center gap-1 mt-2 text-sm text-green-800 hover:text-green-900 underline">
                                               View in Scheduled Assessments
                                               <ExternalLink className="w-3 h-3" />
                                             </Link>
                                           </div>
                                         )}
                                       </div>
                                     </div>
                                   )}

                                  <div>
                                    <h4 className="font-semibold mb-2">Processing Notes</h4>
                                    <Textarea
                                      placeholder="Add notes about this request..."
                                      value={processingNotes}
                                      onChange={(e) => setProcessingNotes(e.target.value)}
                                    />
                                  </div>

                                    {showDateProposal && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Proposed New Date & Time</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-sm font-medium">Date</label>
                                            <Input
                                              type="date"
                                              value={proposedDate}
                                              onChange={(e) => setProposedDate(e.target.value)}
                                              placeholder="Select a new date"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium">Time</label>
                                            <Input
                                              type="time"
                                              value={proposedTime}
                                              onChange={(e) => setProposedTime(e.target.value)}
                                              placeholder="Select time"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                   {showConfirmation && (
                                     <div>
                                       <h4 className="font-semibold mb-2">Confirm Appointment Date & Time</h4>
                                       <div className="grid grid-cols-2 gap-2">
                                         <div>
                                           <label className="text-sm font-medium">Date</label>
                                           <Input
                                             type="date"
                                             value={confirmedDate}
                                             onChange={(e) => setConfirmedDate(e.target.value)}
                                             placeholder="Select appointment date"
                                           />
                                         </div>
                                         <div>
                                           <label className="text-sm font-medium">Time</label>
                                           <Input
                                             type="time"
                                             value={confirmedTime}
                                             onChange={(e) => setConfirmedTime(e.target.value)}
                                             placeholder="Select appointment time"
                                           />
                                         </div>
                                       </div>
                                     </div>
                                   )}

                                   {selectedRequest.status === 'pending' && !isEditMode && (
                                     <div className="flex justify-end gap-2 flex-wrap">
                                       <Button 
                                         variant="outline" 
                                         onClick={() => handleProcessRequest(selectedRequest.id, 'rejected')}
                                       >
                                         <XCircle className="w-4 h-4 mr-2" />
                                         Decline
                                       </Button>
                                       <Button 
                                         variant="outline"
                                         onClick={() => {
                                           setShowDateProposal(true);
                                         }}
                                       >
                                         <Calendar className="w-4 h-4 mr-2" />
                                         Propose New Date
                                       </Button>
                                        <Button 
                                          onClick={() => {
                                            setShowConfirmation(true);
                                          }}
                                        >
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          Confirm
                                        </Button>
                                     </div>
                                   )}

                                   {/* Edit mode actions for processed requests */}
                                   {isEditMode && (
                                     <div className="flex justify-end gap-2 flex-wrap">
                                       <Button 
                                         variant="outline" 
                                         onClick={() => handleProcessRequest(selectedRequest.id, 'rejected')}
                                       >
                                         <XCircle className="w-4 h-4 mr-2" />
                                         Decline Request
                                       </Button>
                                       {selectedRequest.status !== 'rejected' && (
                                         <>
                                           <Button 
                                             variant="outline"
                                             onClick={() => {
                                               setShowDateProposal(true);
                                               setShowConfirmation(false);
                                             }}
                                           >
                                             <Calendar className="w-4 h-4 mr-2" />
                                             Change Date
                                           </Button>
                                           <Button 
                                             onClick={() => {
                                               setShowConfirmation(true);
                                               setShowDateProposal(false);
                                             }}
                                           >
                                             <CheckCircle className="w-4 h-4 mr-2" />
                                             Update Confirmation
                                           </Button>
                                         </>
                                       )}
                                     </div>
                                   )}

                                   {showDateProposal && (
                                     <div className="flex justify-end gap-2 mt-4">
                                        <Button 
                                          variant="outline" 
                                          onClick={() => {
                                            setShowDateProposal(false);
                                            setProposedDate("");
                                            setProposedTime("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                       <Button 
                                         onClick={() => handleProcessRequest(selectedRequest.id, 'new_date_proposed')}
                                         disabled={!proposedDate}
                                       >
                                         <Calendar className="w-4 h-4 mr-2" />
                                         Send Proposal
                                       </Button>
                                     </div>
                                   )}

                                   {showConfirmation && (
                                     <div className="flex justify-end gap-2 mt-4">
                                       <Button 
                                         variant="outline" 
                                         onClick={() => {
                                           setShowConfirmation(false);
                                           setConfirmedDate("");
                                           setConfirmedTime("");
                                         }}
                                       >
                                         Cancel
                                       </Button>
                                       <Button 
                                         onClick={() => handleProcessRequest(selectedRequest.id, 'approved')}
                                         disabled={!confirmedDate || !confirmedTime}
                                       >
                                         <CheckCircle className="w-4 h-4 mr-2" />
                                         Confirm Appointment
                                       </Button>
                                     </div>
                                   )}
                                </div>
                              )}
                            </DialogContent>
                           </Dialog>
                           {/* Edit button for processed requests */}
                           {(request.status === 'approved' || request.status === 'new_date_proposed' || request.status === 'rejected') && (
                             <Button 
                               variant="outline" 
                               size="sm"
                               onClick={() => handleEditRequest(request)}
                             >
                               <Edit2 className="w-4 h-4 mr-1" />
                               Edit
                             </Button>
                           )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {filteredRequests.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No appointment requests found. {searchTerm && "Try adjusting your search terms."}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AppointmentRequestEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => {
          setEmailDialogOpen(false);
          setSelectedEmailRequest(null);
        }}
        request={selectedEmailRequest}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRequestToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (requestToDelete) {
                  deleteRequest(requestToDelete);
                  setRequestToDelete(null);
                  setDeleteDialogOpen(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanyFooter />
    </div>
  );
};

export default AppointmentRequestDashboard;