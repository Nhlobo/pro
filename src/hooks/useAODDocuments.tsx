import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AODDocument = {
  id: string;
  attorney_id: string;
  law_firm_id: string;
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
  payments_made: number | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export const useAODDocuments = (attorneyId?: string) => {
  const [documents, setDocuments] = useState<AODDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("aod_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (attorneyId) {
        query = query.eq("attorney_id", attorneyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
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
    lawFirmId: string,
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

      // Fetch law firm ID from user profile if not provided
      let finalLawFirmId = lawFirmId;
      if (!finalLawFirmId || finalLawFirmId.trim() === "") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("law_firm_id, role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw new Error("Unable to fetch user profile. Please try again.");
        }
        
        // For admin/employee users without law_firm_id, use special identifier
        if (!profile?.law_firm_id) {
          if (profile?.role === 'admin' || profile?.role === 'employee') {
            finalLawFirmId = 'company-documents';
          } else {
            throw new Error("Unable to determine law firm. Please ensure your profile is set up correctly.");
          }
        } else {
          finalLawFirmId = profile.law_firm_id;
        }
      }
      
      // Referring attorney is now optional - can be added later during sync
      const validAttorneyId = attorneyId && attorneyId.trim() !== "" ? attorneyId : null;
      const fileExt = file.name.split(".").pop();
      const fileName = `${validAttorneyId || 'unassigned'}_${Date.now()}.${fileExt}`;
      const filePath = `${finalLawFirmId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("aod-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert document record
      const insertData: any = {
        law_firm_id: finalLawFirmId,
        document_url: filePath,
        file_name: file.name,
        uploaded_by: user.id,
        ...metadata,
      };
      
      // Only add attorney_id if it's valid
      if (validAttorneyId) {
        insertData.attorney_id = validAttorneyId;
      }

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
      const { data, error } = await supabase.storage
        .from("aod-documents")
        .download(documentUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download document",
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
      attorney_id?: string;
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
  }, [attorneyId]);

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
