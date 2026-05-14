import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email.ts";
import { z } from "npm:zod@3.22.4";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Comprehensive Zod validation schema
const PaymentChangeNotificationSchema = z.object({
  appointmentId: z.string().uuid({ message: "Invalid appointment ID format" }),
  claimantName: z.string()
    .min(1, { message: "Claimant name is required" })
    .max(200, { message: "Claimant name must be less than 200 characters" })
    .trim(),
  expertName: z.string()
    .min(1, { message: "Expert name is required" })
    .max(200, { message: "Expert name must be less than 200 characters" })
    .trim(),
  oldPaymentStatus: z.string()
    .min(1, { message: "Old payment status is required" })
    .max(100, { message: "Old payment status must be less than 100 characters" })
    .trim(),
  newPaymentStatus: z.string()
    .min(1, { message: "New payment status is required" })
    .max(100, { message: "New payment status must be less than 100 characters" })
    .trim(),
  appointmentDate: z.string().datetime({ message: "Invalid appointment date format" }),
  serviceFee: z.number()
    .min(0, { message: "Service fee must be positive" })
    .max(1000000, { message: "Service fee exceeds maximum" }),
  depositAmount: z.number()
    .min(0, { message: "Deposit amount must be positive" })
    .max(1000000, { message: "Deposit amount exceeds maximum" }),
  attorneyName: z.string()
    .min(1, { message: "Attorney name is required" })
    .max(200, { message: "Attorney name must be less than 200 characters" })
    .trim(),
  attorneyEmail: z.string()
    .email({ message: "Invalid attorney email format" })
    .max(255, { message: "Email must be less than 255 characters" })
    .trim()
    .toLowerCase()
}).strict();

const handler = async (req: Request): Promise<Response> => {
  console.log("Payment change notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = PaymentChangeNotificationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.format());
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    const { 
      appointmentId,
      claimantName,
      expertName,
      oldPaymentStatus,
      newPaymentStatus,
      appointmentDate,
      serviceFee,
      depositAmount,
      attorneyName,
      attorneyEmail
    } = validationResult.data;

    console.log("Processing payment change notification for:", appointmentId);

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatPaymentStatus = (status: string) => {
      switch(status.toLowerCase()) {
        case 'pending': return 'Pending Payment';
        case 'deposit': return 'Deposit Paid';
        case 'full_payment': return 'Fully Paid';
        default: return status;
      }
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #0369a1; margin: 0 0 10px 0;">Payment Status Update</h1>
          <p style="color: #075985; margin: 0;">The payment status for your appointment has been updated.</p>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #374151; margin-top: 0;">Payment Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Patient:</td>
              <td style="padding: 8px 0; color: #374151;">${claimantName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Medical Expert:</td>
              <td style="padding: 8px 0; color: #374151;">Dr. ${expertName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Appointment Date:</td>
              <td style="padding: 8px 0; color: #374151;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Service Fee:</td>
              <td style="padding: 8px 0; color: #374151;">$${serviceFee.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Deposit Amount:</td>
              <td style="padding: 8px 0; color: #374151;">$${depositAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Previous Status:</td>
              <td style="padding: 8px 0; color: #ef4444;">${formatPaymentStatus(oldPaymentStatus)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Current Status:</td>
              <td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${formatPaymentStatus(newPaymentStatus)}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #166534; margin-top: 0;">Payment Information:</h3>
          <p style="color: #166534; margin-bottom: 0;">
            ${newPaymentStatus === 'full_payment' ? 
              'Thank you! Your payment has been processed successfully. The assessment can now proceed as scheduled.' :
              newPaymentStatus === 'deposit' ?
              'Your deposit has been received. Please ensure full payment is completed before the assessment date.' :
              'Payment is still pending. Please ensure payment is processed to avoid any delays with your appointment.'
            }
          </p>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p style="color: #4b5563; margin: 0; font-size: 14px;">
            This is an automated notification regarding your payment status. 
            If you have any questions about payments, please contact our billing department.
          </p>
        </div>
      </div>
    `;

    if (!attorneyEmail) {
      console.log("No attorney email provided, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No attorney email provided",
          emailsSent: 0 
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Send to attorney and employees
    const recipients = [attorneyEmail];
    
    // Get employee notification emails for payment changes
    try {
      const employeeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/employee_notifications?select=email&is_active=eq.true&receive_payment_changes=eq.true`, {
        headers: {
          'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
          'authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'content-type': 'application/json'
        }
      });
      
      if (employeeResponse.ok) {
        const employeeData = await employeeResponse.json();
        if (employeeData && employeeData.length > 0) {
          employeeData.forEach((emp: any) => {
            if (emp.email && !recipients.includes(emp.email)) {
              recipients.push(emp.email);
            }
          });
        }
      }
    } catch (error) {
      console.error("Could not fetch employee emails:", error);
    }

    // Queue emails for all recipients
    const queuePromises = recipients.map(email => 
      fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/email_queue`, {
        method: 'POST',
        headers: {
          'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
          'authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'content-type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          email_type: 'payment_change',
          recipient_email: email,
          recipient_name: email === attorneyEmail ? attorneyName : 'Team Member',
          subject: `Payment Status Updated - ${claimantName} (${formatPaymentStatus(newPaymentStatus)})`,
          html_content: emailHtml,
          metadata: {
            appointment_id: appointmentId,
            claimant_name: claimantName,
            old_payment_status: oldPaymentStatus,
            new_payment_status: newPaymentStatus,
            service_fee: serviceFee,
            deposit_amount: depositAmount
          },
          related_record_id: appointmentId,
          related_table: 'appointments',
          status: 'pending'
        })
      })
    );

    const emailResults = await Promise.allSettled(queuePromises);
    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;

    console.log(`Payment change notifications queued for ${successfulEmails} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        emailsQueued: successfulEmails,
        totalRecipients: recipients.length
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-attorney-payment-change function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(withErrorHandler(handler));