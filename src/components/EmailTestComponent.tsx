import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Send, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const EmailTestComponent = () => {
  const [testEmail, setTestEmail] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address to test",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-email-delivery", {
        body: {
          testEmail,
          fromDomain: customDomain || undefined,
        },
      });

      if (error) {
        throw error;
      }

      setResults(data);
      toast({
        title: "Test Email Sent",
        description: "Check your email inbox and spam folder for test messages",
      });
    } catch (error: any) {
      console.error("Email test error:", error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-border/50 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal rounded-lg">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-lg font-semibold">Email Delivery Test</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Test Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="Enter email to test delivery"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom Domain (Optional)</Label>
            <Input
              id="custom-domain"
              type="text"
              placeholder="e.g., kutlwanoassociate.com"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="bg-background/50"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to test with default Resend domain
            </p>
          </div>

          <Button
            onClick={handleTestEmail}
            disabled={loading || !testEmail}
            className="w-full bg-gradient-to-r from-kutlwano-blue to-kutlwano-teal hover:from-kutlwano-blue/90 hover:to-kutlwano-teal/90"
          >
            {loading ? (
              "Sending Test Emails..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Emails
              </>
            )}
          </Button>
        </div>

        {results && (
          <div className="space-y-4 p-4 bg-background/30 rounded-lg border">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Test Results
            </h4>
            
            <div className="space-y-3">
              {results.defaultDomainResult && (
                <div className="flex items-center justify-between p-3 bg-background/50 rounded border">
                  <span className="text-sm">Default Domain Test</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Sent: {results.defaultDomainResult.id}
                  </Badge>
                </div>
              )}
              
              {results.customDomainResult && (
                <div className="flex items-center justify-between p-3 bg-background/50 rounded border">
                  <span className="text-sm">Custom Domain Test</span>
                  {results.customDomainResult.error ? (
                    <Badge variant="destructive">
                      Failed: {results.customDomainResult.error}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Sent: {results.customDomainResult.id}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {results.troubleshooting?.message}
              </p>
              <p>Check Resend dashboard for detailed delivery status</p>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-2">
          <h5 className="font-medium text-foreground">Troubleshooting Tips:</h5>
          <ul className="space-y-1 pl-4">
            <li>• Check spam/junk folders if emails aren't received</li>
            <li>• Verify domain DNS settings in Resend dashboard</li>
            <li>• Ensure SPF/DKIM records are properly configured</li>
            <li>• Test with different email providers (Gmail, Outlook, etc.)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};