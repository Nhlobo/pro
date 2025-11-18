import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AODGenerationRequest {
  aodDocumentId: string;
  previewMode?: boolean;
  customData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { aodDocumentId, previewMode = false, customData }: AODGenerationRequest = await req.json();

    // Fetch AOD document details with attorney and company info
    const { data: aodDoc, error: aodError } = await supabaseClient
      .from('aod_documents')
      .select(`
        *,
        referring_attorneys:referring_attorney_id (
          id,
          name,
          contact_person,
          email,
          phone,
          registration_number
        )
      `)
      .eq('id', aodDocumentId)
      .single();

    if (aodError || !aodDoc) {
      throw new Error('AOD document not found');
    }

    const attorney = aodDoc.referring_attorneys;
    
    // Use custom data if provided (for preview edits), otherwise use AOD data
    const data = customData || aodDoc;
    
    // Calculate payment details
    const totalDebt = parseFloat(data.total_contract_value || aodDoc.total_contract_value || '0');
    const depositAmount = parseFloat(data.deposit_amount || aodDoc.deposit_amount || '0');
    const remainingBalance = totalDebt - depositAmount;
    const paymentsMade = parseFloat(data.payments_made || aodDoc.payments_made || '0');
    const currentBalance = remainingBalance - paymentsMade;
    
    // Determine term description
    const termMonths = data.agreement_duration_months || aodDoc.agreement_duration_months || 0;
    let termDescription = '';
    if (termMonths <= 1) termDescription = '30 Days';
    else if (termMonths <= 2) termDescription = '60 Days';
    else if (termMonths <= 3) termDescription = '90 Days';
    else if (termMonths <= 6) termDescription = '6 Months';
    else if (termMonths <= 12) termDescription = '12 Months';
    else termDescription = '24 Months';

    // Calculate quarterly payment amount
    const quarters = Math.ceil(termMonths / 3);
    const quarterlyPayment = quarters > 0 ? (remainingBalance / quarters).toFixed(2) : '0.00';

    // Generate PDF using jsPDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Add watermark if preview mode
    if (previewMode) {
      doc.setTextColor(255, 0, 0);
      doc.setFontSize(60);
      doc.setFont(undefined, 'bold');
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.1 }));
      doc.text('DRAFT', pageWidth / 2, pageHeight / 2, { 
        angle: 45, 
        align: 'center' 
      });
      doc.restoreGraphicsState();
      doc.setTextColor(0, 0, 0);
    }

    // Header
    doc.setFillColor(31, 182, 206);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('KUTLWANO & ASSOCIATES', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('Medico-Legal Experts', pageWidth / 2, 30, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    yPos = 50;

    // Document title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('AGREEMENT OF DEBT (AOD)', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Agreement details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(\`Reference: \${aodDocumentId.substring(0, 8).toUpperCase()}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Date: \${new Date().toLocaleDateString('en-ZA')}\`, 20, yPos);
    yPos += 15;

    // Party 1 - Kutlwano & Associates
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PARTY 1: SERVICE PROVIDER', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos - 5, pageWidth - 30, 25, 'F');
    doc.text('Company: Kutlwano & Associates', 20, yPos);
    yPos += 7;
    doc.text('Registration: 2018/123456/07', 20, yPos);
    yPos += 7;
    doc.text('Contact: info@kamedico-legal.co.za', 20, yPos);
    yPos += 15;

    // Party 2 - Attorney
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PARTY 2: REFERRING ATTORNEY', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos - 5, pageWidth - 30, 25, 'F');
    doc.text(\`Firm: \${attorney?.name || 'N/A'}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Contact Person: \${attorney?.contact_person || 'N/A'}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Email: \${attorney?.email || 'N/A'}\`, 20, yPos);
    yPos += 15;

    // Financial Summary
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('FINANCIAL SUMMARY', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(\`Total Contract Value: R \${totalDebt.toFixed(2)}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Deposit Paid: R \${depositAmount.toFixed(2)}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Outstanding Balance: R \${remainingBalance.toFixed(2)}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Payment Term: \${termDescription}\`, 20, yPos);
    yPos += 7;
    doc.text(\`Quarterly Payment: R \${quarterlyPayment}\`, 20, yPos);
    yPos += 15;

    // Terms
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT TERMS', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const terms = [
      '1. The Referring Attorney acknowledges the debt amount stated above.',
      '2. Payment shall be made according to the agreed payment schedule.',
      '3. Late payments may incur interest as per the agreed terms.',
      '4. This agreement is binding upon both parties.',
    ];
    
    terms.forEach(term => {
      doc.text(term, 20, yPos, { maxWidth: pageWidth - 40 });
      yPos += 7;
    });

    // Convert to base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    // Store the PDF in Supabase storage if not preview mode
    let documentUrl = null;
    if (!previewMode) {
      const fileName = \`aod-\${aodDocumentId}-\${Date.now()}.pdf\`;
      const pdfBlob = doc.output('blob');
      
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('documents')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabaseClient
          .storage
          .from('documents')
          .getPublicUrl(fileName);
        
        documentUrl = urlData.publicUrl;
        
        // Update AOD document with URL
        await supabaseClient
          .from('aod_documents')
          .update({ 
            document_url: documentUrl,
            file_name: fileName,
            updated_at: new Date().toISOString()
          })
          .eq('id', aodDocumentId);
      }
    }

    // Log the generation (only if not preview mode)
    if (!previewMode) {
      await supabaseClient.from('audit_logs').insert({
        user_id: (await supabaseClient.auth.getUser()).data.user?.id,
        action_type: 'CREATE',
        table_name: 'aod_documents',
        record_id: aodDocumentId,
        description: `Generated AOD PDF for ${attorney?.name}`,
        function_area: 'AOD Management',
        new_values: { generated: true }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfData: pdfBase64,
        documentUrl,
        metadata: {
          attorneyName: attorney?.name,
          attorneyEmail: attorney?.email,
          totalDebt,
          depositAmount,
          remainingBalance,
          reference: aodDocumentId.substring(0, 8).toUpperCase()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating AOD PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to convert numbers to words (simplified)
function numberToWords(num: number): string {
  // Simplified implementation - returns formatted number
  return num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
