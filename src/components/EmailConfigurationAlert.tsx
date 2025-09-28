import React from 'react';
import { AlertCircle, Settings, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface EmailConfigurationAlertProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const EmailConfigurationAlert: React.FC<EmailConfigurationAlertProps> = ({ 
  isVisible, 
  onDismiss 
}) => {
  if (!isVisible) return null;

  const handleOpenSupabaseSettings = () => {
    window.open('https://supabase.com/dashboard/project/zybkhhxvsdjkluqydcbb/auth/providers', '_blank');
  };

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertCircle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">Email Configuration Required</AlertTitle>
      <AlertDescription className="text-orange-700">
        <div className="space-y-3">
          <p>
            The email system requires SMTP configuration in Supabase to send confirmation emails. 
            Without proper SMTP settings, users won't receive email confirmations.
          </p>
          
          <div className="bg-white p-3 rounded border border-orange-200">
            <h4 className="font-semibold text-orange-800 mb-2">How to configure SMTP:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to your Supabase project dashboard</li>
              <li>Navigate to Authentication → Settings → SMTP Settings</li>
              <li>Configure your email provider (Gmail, SendGrid, etc.)</li>
              <li>Test the configuration</li>
            </ol>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleOpenSupabaseSettings}
              variant="outline" 
              size="sm"
              className="text-orange-700 border-orange-300 hover:bg-orange-100"
            >
              <Settings className="h-4 w-4 mr-2" />
              Open Supabase Settings
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button 
              onClick={onDismiss}
              variant="ghost" 
              size="sm"
              className="text-orange-600 hover:bg-orange-100"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};