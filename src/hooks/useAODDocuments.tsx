import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AODDocument = {
  id: string;
  attorney_id: string;
  law_firm_id: string;
  document_url: string;
  file_name: string;
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
    }
  ) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${attorneyId}_${Date.now()}.${fileExt}`;
      const filePath = `${lawFirmId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("aod-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Insert document record
      const { error: insertError } = await supabase
        .from("aod_documents")
        .insert({
          attorney_id: attorneyId,
          law_firm_id: lawFirmId,
          document_url: filePath,
          file_name: file.name,
          uploaded_by: user.id,
          ...metadata,
        });

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
