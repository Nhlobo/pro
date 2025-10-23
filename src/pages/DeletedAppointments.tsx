import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useDeletedAppointments } from "@/hooks/useDeletedAppointments";
import CompanyFooter from "@/components/CompanyFooter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DeletedAppointments = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  
  const { 
    deletedAppointments, 
    loading, 
    restoreAppointment, 
    permanentlyDelete 
  } = useDeletedAppointments();

  const filteredAppointments = deletedAppointments.filter(appointment => {
    const searchLower = searchTerm.toLowerCase();
    return (
      appointment.claimant_name?.toLowerCase().includes(searchLower) ||
      appointment.expert_name?.toLowerCase().includes(searchLower) ||
      appointment.referring_attorney?.toLowerCase().includes(searchLower) ||
      appointment.claimant_auto_id?.toLowerCase().includes(searchLower)
    );
  });

  const handleRestoreClick = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setRestoreDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (selectedAppointmentId) {
      const success = await restoreAppointment(selectedAppointmentId);
      if (success) {
        setRestoreDialogOpen(false);
        setSelectedAppointmentId(null);
      }
    }
  };

  const handlePermanentDeleteClick = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setDeleteDialogOpen(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (selectedAppointmentId) {
      const success = await permanentlyDelete(selectedAppointmentId);
      if (success) {
        setDeleteDialogOpen(false);
        setSelectedAppointmentId(null);
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Deleted Appointments - Data Recovery | Medical Assessment System</title>
        <meta name="description" content="View and restore deleted appointment records in the medical assessment management system" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="hover:bg-accent">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Deleted Appointments</h1>
                <p className="text-sm text-muted-foreground">Recover or permanently remove deleted records</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="border-border shadow-lg">
            <CardHeader className="bg-gradient-to-r from-card to-accent/10 border-b border-border">
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Recovery Center
              </CardTitle>
              <CardDescription>
                View and restore recently deleted appointments. Deleted appointments are retained for 90 days.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search by claimant, expert, attorney, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background border-border"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading deleted appointments...</p>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? 'No deleted appointments match your search' : 'No deleted appointments found'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-accent/5">
                        <TableHead className="font-semibold">Claimant ID</TableHead>
                        <TableHead className="font-semibold">Claimant Name</TableHead>
                        <TableHead className="font-semibold">Expert</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Attorney</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Deleted</TableHead>
                        <TableHead className="font-semibold">Deleted By</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map((appointment) => (
                        <TableRow key={appointment.id} className="hover:bg-accent/5">
                          <TableCell className="font-medium">
                            <Badge variant="outline">{appointment.claimant_auto_id}</Badge>
                          </TableCell>
                          <TableCell>{appointment.claimant_name}</TableCell>
                          <TableCell>{appointment.expert_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{appointment.expert_type}</Badge>
                          </TableCell>
                          <TableCell>{appointment.referring_attorney}</TableCell>
                          <TableCell>
                            {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(appointment.deleted_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {appointment.deleted_by_email || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleRestoreClick(appointment.id)}
                                className="gap-2"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handlePermanentDeleteClick(appointment.id)}
                                className="gap-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <CompanyFooter />
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the deleted appointment and all its associated data. 
              The appointment will be visible in the scheduled assessments list again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The appointment and all its data will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DeletedAppointments;
