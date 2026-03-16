import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, FileQuestion, Send, Search, Loader2 } from 'lucide-react';

interface RecipientInfo {
  id: string;
  name: string;
  email: string;
  type: 'attorney' | 'expert';
}

const CommunicationsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('send-report');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientType, setRecipientType] = useState<'attorney' | 'expert'>('attorney');
  const [searchResults, setSearchResults] = useState<RecipientInfo[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientInfo | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [documentTypes, setDocumentTypes] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const searchRecipients = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      if (recipientType === 'attorney') {
        const { data, error } = await supabase
          .from('referring_attorneys')
          .select('id, name, email')
          .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults(
          (data || []).filter(a => a.email).map(a => ({
            id: a.id,
            name: a.name,
            email: a.email!,
            type: 'attorney' as const,
          }))
        );
      } else {
        const { data, error } = await supabase
          .from('medical_experts')
          .select('id, first_name, last_name, email')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults(
          (data || []).filter(e => e.email).map(e => ({
            id: e.id,
            name: `${e.first_name} ${e.last_name}`,
            email: e.email!,
            type: 'expert' as const,
          }))
        );
      }
    } catch (error: any) {
      toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const resetForm = () => {
    setSelectedRecipient(null);
    setSubject('');
    setMessage('');
    setCaseReference('');
    setDocumentTypes('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const queueEmail = async (emailType: string, htmlContent: string, emailSubject: string) => {
    if (!selectedRecipient) {
      toast({ title: 'No recipient selected', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.from('email_queue').insert({
        email_type: emailType,
        recipient_email: selectedRecipient.email,
        recipient_name: selectedRecipient.name,
        subject: emailSubject,
        html_content: htmlContent,
        status: 'pending',
        metadata: {
          recipient_type: selectedRecipient.type,
          case_reference: caseReference,
          communication_type: emailType,
        },
      });
      if (error) throw error;

      // Log to audit
      await supabase.from('audit_logs').insert({
        table_name: 'email_queue',
        action_type: 'COMMUNICATION_QUEUED',
        function_area: 'communications',
        description: `${emailType} queued for ${selectedRecipient.type}: ${selectedRecipient.name} (${selectedRecipient.email})`,
        new_values: {
          email_type: emailType,
          recipient: selectedRecipient.name,
          case_reference: caseReference,
        },
      });

      toast({ title: 'Email queued successfully', description: 'The communication has been added to the email queue for review.' });
      resetForm();
    } catch (error: any) {
      toast({ title: 'Failed to queue email', description: error.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReport = () => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1fb6ce; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Report Delivery</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Recipient:</strong> ${selectedRecipient?.name}</p>
          ${caseReference ? `<p><strong>Case Reference:</strong> ${caseReference}</p>` : ''}
        </div>
        <div style="padding: 15px 0;">
          <p>${message || 'Please find the attached report for your review.'}</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">This is an automated notification from KA Medico-Legal. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;
    queueEmail('report_delivery', html, subject || `Report Delivery${caseReference ? ` - ${caseReference}` : ''}`);
  };

  const handleRequestDocument = () => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Missing Document Request</h2>
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="margin-top: 0; color: #92400e;">Action Required</h3>
          <p style="margin: 0;">The following documents are required to proceed with the case.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Recipient:</strong> ${selectedRecipient?.name}</p>
          ${caseReference ? `<p><strong>Case Reference:</strong> ${caseReference}</p>` : ''}
          ${documentTypes ? `<p><strong>Required Documents:</strong> ${documentTypes}</p>` : ''}
        </div>
        <div style="padding: 15px 0;">
          <p>${message || 'Kindly submit the above-mentioned documents at your earliest convenience to avoid delays.'}</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">This is an automated notification from KA Medico-Legal. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;
    queueEmail('missing_document_request', html, subject || `Missing Document Request${caseReference ? ` - ${caseReference}` : ''}`);
  };

  const handleSendInstruction = () => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">New Instruction</h2>
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="margin-top: 0; color: #1e40af;">New Instruction Notice</h3>
          <p style="margin: 0;">You have received a new instruction regarding the below matter.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Recipient:</strong> ${selectedRecipient?.name}</p>
          ${caseReference ? `<p><strong>Case Reference:</strong> ${caseReference}</p>` : ''}
        </div>
        <div style="padding: 15px 0;">
          <p>${message}</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">This is an automated notification from KA Medico-Legal. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;
    queueEmail('new_instruction', html, subject || `New Instruction${caseReference ? ` - ${caseReference}` : ''}`);
  };

  const RecipientSearch = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label>Recipient Type</Label>
          <Select value={recipientType} onValueChange={(v: 'attorney' | 'expert') => { setRecipientType(v); setSearchResults([]); setSelectedRecipient(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="attorney">Referring Attorney</SelectItem>
              <SelectItem value="expert">Medical Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-[2]">
          <Label>Search {recipientType === 'attorney' ? 'Attorney' : 'Expert'}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={`Search by name or email...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchRecipients()}
            />
            <Button variant="outline" size="icon" onClick={searchRecipients} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {selectedRecipient && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Badge variant="secondary">{selectedRecipient.type === 'attorney' ? 'Attorney' : 'Expert'}</Badge>
          <span className="font-medium text-sm">{selectedRecipient.name}</span>
          <span className="text-xs text-muted-foreground">({selectedRecipient.email})</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setSelectedRecipient(null)}>Change</Button>
        </div>
      )}

      {!selectedRecipient && searchResults.length > 0 && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {searchResults.map((r) => (
            <button
              key={r.id}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between"
              onClick={() => { setSelectedRecipient(r); setSearchResults([]); }}
            >
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.email}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="send-report" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Send Report
          </TabsTrigger>
          <TabsTrigger value="request-document" className="flex items-center gap-1.5 text-xs">
            <FileQuestion className="h-3.5 w-3.5" /> Request Document
          </TabsTrigger>
          <TabsTrigger value="new-instruction" className="flex items-center gap-1.5 text-xs">
            <Send className="h-3.5 w-3.5" /> New Instruction
          </TabsTrigger>
        </TabsList>

        {/* Send Report */}
        <TabsContent value="send-report">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send Report</CardTitle>
              <CardDescription>Deliver a report to a referring attorney or medical expert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RecipientSearch />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Case Reference</Label>
                  <Input placeholder="e.g. KA-2026-001" value={caseReference} onChange={(e) => setCaseReference(e.target.value)} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input placeholder="Report Delivery" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Textarea placeholder="Add a message to accompany the report..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
              </div>
              <Button onClick={handleSendReport} disabled={!selectedRecipient || isSending} className="w-full sm:w-auto">
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Queue Report Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Request Missing Document */}
        <TabsContent value="request-document">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Missing Document</CardTitle>
              <CardDescription>Request outstanding documents from attorneys or experts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RecipientSearch />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Case Reference</Label>
                  <Input placeholder="e.g. KA-2026-001" value={caseReference} onChange={(e) => setCaseReference(e.target.value)} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input placeholder="Missing Document Request" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Required Documents</Label>
                <Input placeholder="e.g. RAF1 Form, Medical Records, Police Report" value={documentTypes} onChange={(e) => setDocumentTypes(e.target.value)} />
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Textarea placeholder="Provide details about the required documents..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
              </div>
              <Button onClick={handleRequestDocument} disabled={!selectedRecipient || isSending} className="w-full sm:w-auto" variant="default">
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileQuestion className="h-4 w-4 mr-2" />}
                Queue Document Request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Instruction */}
        <TabsContent value="new-instruction">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send New Instruction</CardTitle>
              <CardDescription>Send a new instruction to a referring attorney or medical expert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RecipientSearch />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Case Reference</Label>
                  <Input placeholder="e.g. KA-2026-001" value={caseReference} onChange={(e) => setCaseReference(e.target.value)} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input placeholder="New Instruction" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Instruction Details <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Provide the full instruction details..." value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
              </div>
              <Button onClick={handleSendInstruction} disabled={!selectedRecipient || !message.trim() || isSending} className="w-full sm:w-auto">
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Queue Instruction Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsModule;
