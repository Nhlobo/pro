import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AODDocument = {
  id: string;
  referring_attorney_id: string;
  document_url: string;
  file_name: string;
  contract_description: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  payment_plan_structure: string | null;
  payment_due_date: string | null;
  deposit_amount: number | null;
  interest_rate_1_3_months: number | null;
  interest_rate_6_months: number | null;
  interest_rate_12_months: number | null;
  interest_rate_18_months: number | null;
  interest_rate_24_months: number | null;
  notes: string | null;
  payment_status: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  total_contract_value: number | null;
  total_reports_agreed: number | null;
  payments_made: number | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  referring_attorneys?: {
    name: string;
    contact_person: string | null;
  };
  assessment_count?: number;
  claimant_details?: string;
  linked_appointment_id?: string | null;
  appointment_date?: string | null;
};

export const useAODDocuments = (attorneyId?: string) => {
  const [documents, setDocuments] = useState<AODDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // Fetch AOD documents with referring attorney info
      const { data: aodDocs, error } = await supabase
        .from("aod_documents")
        .select(`
          *,
          referring_attorneys!inner(name, contact_person)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each AOD document, get ONLY the specific linked appointment (individual transaction)
      const enrichedDocs = await Promise.all(
        (aodDocs || []).map(async (doc) => {
          // Extract appointment ID from notes (format: "APPOINTMENT:{id}")
          const appointmentMatch = doc.notes?.match(/APPOINTMENT:([a-f0-9-]+)/i);
          const specificAppointmentId = appointmentMatch ? appointmentMatch[1] : null;

          // Get the specific linked appointment details (individual transaction)
          let claimantSummary = "No scheduled appointment linked";
          let linkedAppointmentId = null;
          let appointmentDate = null;
          let assessmentCount = 0;

          if (specificAppointmentId) {
            const { data: appointment } = await supabase
              .from("appointments")
              .select(`
                id,
                appointment_date,
                case_status,
                claimants!inner(auto_id, first_name, last_name)
              `)
              .eq("id", specificAppointmentId)
              .in("case_status", ["scheduled", "assessed"])
              .is("deleted_at", null)
              .single();

            if (appointment) {
              const claimant = appointment.claimants;
              claimantSummary = `${claimant.auto_id} - ${claimant.first_name} ${claimant.last_name}`;
              linkedAppointmentId = appointment.id;
              appointmentDate = appointment.appointment_date;
              assessmentCount = 1; // Only 1 assessment per AOD document (individual transaction)
            }
          }

          return {
            ...doc,
            assessment_count: assessmentCount, // Only the linked appointment
            claimant_details: claimantSummary,
            linked_appointment_id: linkedAppointmentId,
            appointment_date: appointmentDate,
          };
        })
      );

      setDocuments(enrichedDocs);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch AOD documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (
    file: File,
    attorneyId: string,
    referringAttorneyId: string,
    metadata: {
      contract_description?: string;
      contract_start_date?: string;
      contract_end_date?: string;
      payment_plan_structure?: string;
      payment_due_date?: string;
      deposit_amount?: number;
      interest_rate_1_3_months?: number;
      interest_rate_6_months?: number;
      interest_rate_12_months?: number;
      interest_rate_18_months?: number;
      interest_rate_24_months?: number;
      notes?: string;
      payment_status?: string;
      next_payment_date?: string;
      total_contract_value?: number;
      payments_made?: number;
    }
  ) => {
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fetch referring attorney ID from user profile if not provided
      let finalReferringAttorneyId = referringAttorneyId;
      if (!finalReferringAttorneyId || finalReferringAttorneyId.trim() === "") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("referring_attorney_id, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw new Error("Unable to fetch user profile. Please try again.");
        }
        
        // For admin/employee users without referring_attorney_id, get or create system company
        if (!profile?.referring_attorney_id) {
          if (profile?.role === 'admin' || profile?.role === 'employee') {
            // Get system company referring attorney
            const { data: systemCompany } = await supabase
              .from("referring_attorneys")
              .select("id")
              .eq("is_system_company", true)
              .single();
            
            if (systemCompany?.id) {
              finalReferringAttorneyId = systemCompany.id;
            } else {
              throw new Error("System company not found. Please contact administrator.");
            }
          } else {
            throw new Error("Unable to determine referring attorney. Please ensure your profile is set up correctly.");
          }
        } else {
          finalReferringAttorneyId = profile.referring_attorney_id;
        }
      }
      
      // Note: attorneyId is NOT used as it represents referring_attorneys records, not attorneys table records
      // The attorney_id field will remain null and can be assigned manually later
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${finalReferringAttorneyId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("aod-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert document record - DO NOT include attorney_id to avoid foreign key errors
      const insertData: any = {
        referring_attorney_id: finalReferringAttorneyId,
        document_url: filePath,
        file_name: file.name,
        uploaded_by: user.id,
        ...metadata,
      };

      const { error: insertError } = await supabase
        .from("aod_documents")
        .insert(insertData);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "AOD document uploaded successfully",
      });

      fetchDocuments();
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
      return false;
    }
  };

  const downloadDocument = async (documentUrl: string, fileName: string) => {
    try {
      // Check if documentUrl is empty or pending
      if (!documentUrl || documentUrl === 'pending' || documentUrl.trim() === '') {
        toast({
          title: "Not Available",
          description: "Document has not been generated yet",
          variant: "destructive",
        });
        return;
      }

      // If it's a Supabase storage URL, extract the path and use Supabase client
      if (documentUrl.startsWith('http://') || documentUrl.startsWith('https://')) {
        // Check if it's a Supabase storage URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zybkhhxvsdjkluqydcbb.supabase.co';
        if (documentUrl.includes(supabaseUrl) && documentUrl.includes('/storage/v1/object/')) {
          // Extract bucket and path from URL
          // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
          const urlParts = documentUrl.split('/storage/v1/object/');
          if (urlParts.length > 1) {
            const pathParts = urlParts[1].split('/');
            pathParts.shift(); // Remove 'public' or 'sign'
            const bucket = pathParts.shift(); // Get bucket name
            const path = pathParts.join('/'); // Remaining is the file path
            
            if (bucket && path) {
              // Download using Supabase client with proper authentication
              const { data, error } = await supabase.storage
                .from(bucket)
                .download(path);

              if (error) throw error;

              const url = URL.createObjectURL(data);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              toast({
                title: "Success",
                description: "Document downloaded successfully",
              });
              return;
            }
          }
        }
        
        // If it's not a Supabase URL or parsing failed, try direct fetch
        const response = await fetch(documentUrl);
        if (!response.ok) throw new Error('Failed to fetch document');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: "Document downloaded successfully",
        });
        return;
      }

      // Otherwise, it's a storage path - determine which bucket
      let bucket = "aod-documents";
      
      // If the path starts with "aod-" or contains "aod-documents", it's likely in the documents bucket
      if (documentUrl.startsWith('aod-') || documentUrl.includes('aod-documents')) {
        bucket = "documents";
      }

      // Try to download from the determined bucket
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(documentUrl);

      if (error) {
        // If it fails, try the other bucket
        const alternateBucket = bucket === "aod-documents" ? "documents" : "aod-documents";
        const { data: altData, error: altError } = await supabase.storage
          .from(alternateBucket)
          .download(documentUrl);
          
        if (altError) throw error; // Throw the original error
        
        // Success with alternate bucket
        const url = URL.createObjectURL(altData);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: "Document downloaded successfully",
        });
        return;
      }

      // Success with primary bucket
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to download document. The document may not exist or you don't have permission to access it.",
        variant: "destructive",
      });
    }
  };

  const deleteDocument = async (id: string, documentUrl: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("aod-documents")
        .remove([documentUrl]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("aod_documents")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const updateDocument = async (
    id: string,
    metadata: {
      contract_description?: string;
      contract_start_date?: string;
      contract_end_date?: string;
      payment_plan_structure?: string;
      payment_due_date?: string;
      deposit_amount?: number;
      interest_rate_1_3_months?: number;
      interest_rate_6_months?: number;
      interest_rate_12_months?: number;
      interest_rate_18_months?: number;
      interest_rate_24_months?: number;
      notes?: string;
      payment_status?: string;
      next_payment_date?: string;
      total_contract_value?: number;
      payments_made?: number;
      total_reports_agreed?: number;
    }
  ) => {
    try {
      const { error } = await supabase
        .from("aod_documents")
        .update(metadata)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document updated successfully",
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update document",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [attorneyId]); // Removed lastUpdate dependency to prevent redundant fetches

  return {
    documents,
    loading,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    updateDocument,
    refetch: fetchDocuments,
  };
};
