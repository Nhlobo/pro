import React, { useState, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileSignature,
  FileText,
  Download,
  Eye,
  Calendar,
  Clock,
  CheckCircle2
} from "lucide-react";
import { format } from 'date-fns';

import { RandSign } from "@/components/icons/RandSign";
interface Agreement {
  id: string;
  file_name: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  total_reports_agreed: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  payment_status: string | null;
  created_at: string;
  document_url: string;
  type: 'short-term' | 'long-term';
}

const AttorneyAgreements: React.FC = () => {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    try {
      // Fetch AOD documents (could be long-term or short-term based on duration)
      const { data: aodData } = await supabase
        .from('aod_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (aodData) {
        const processedAgreements: Agreement[] = aodData.map(doc => {
          // Determine if short-term (<=6 months) or long-term
          let type: 'short-term' | 'long-term' = 'long-term';
          if (doc.contract_start_date && doc.contract_end_date) {
            const start = new Date(doc.contract_start_date);
            const end = new Date(doc.contract_end_date);
            const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                              (end.getMonth() - start.getMonth());
            type = monthsDiff <= 6 ? 'short-term' : 'long-term';
          }

          return {
            id: doc.id,
            file_name: doc.file_name,
            total_contract_value: doc.total_contract_value,
            deposit_amount: doc.deposit_amount,
            total_reports_agreed: doc.total_reports_agreed,
            contract_start_date: doc.contract_start_date,
            contract_end_date: doc.contract_end_date,
            payment_status: doc.payment_status,
            created_at: doc.created_at,
            document_url: doc.document_url,
            type
          };
        });
        setAgreements(processedAgreements);
      }
    } catch (error) {
      console.error('Error fetching agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const shortTermAgreements = agreements.filter(a => a.type === 'short-term');
  const longTermAgreements = agreements.filter(a => a.type === 'long-term');

  const AgreementTable = ({ items }: { items: Agreement[] }) => (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agreement</TableHead>
            <TableHead>Contract Value</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Reports</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((agreement) => (
            <TableRow key={agreement.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-kutlwano-blue" />
                  <span className="font-medium">{agreement.file_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RandSign className="h-4 w-4 text-muted-foreground" />
                  R{(agreement.total_contract_value || 0).toLocaleString()}
                </div>
              </TableCell>
              <TableCell>
                R{(agreement.deposit_amount || 0).toLocaleString()}
              </TableCell>
              <TableCell>
                {agreement.total_reports_agreed || 0}
              </TableCell>
              <TableCell>
                {agreement.contract_start_date && agreement.contract_end_date ? (
                  <div className="text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(agreement.contract_start_date), 'MMM yyyy')} - 
                      {format(new Date(agreement.contract_end_date), 'MMM yyyy')}
                    </div>
                  </div>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>
                <Badge
                  className={
                    agreement.payment_status === 'paid'
                      ? 'bg-success/10 text-success border-success/20'
                      : agreement.payment_status === 'overdue'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  }
                >
                  {agreement.payment_status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {agreement.payment_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                  {agreement.payment_status || 'Pending'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="h-8 w-8 text-kutlwano-blue" />
            Agreements
          </h1>
          <p className="text-muted-foreground mt-1">
            View and download your short-term and long-term agreements
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agreements</p>
                  <p className="text-2xl font-bold text-foreground">{agreements.length}</p>
                </div>
                <div className="p-3 bg-kutlwano-blue/10 rounded-lg">
                  <FileSignature className="h-6 w-6 text-kutlwano-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Short-Term</p>
                  <p className="text-2xl font-bold text-kutlwano-teal">{shortTermAgreements.length}</p>
                </div>
                <div className="p-3 bg-kutlwano-teal/10 rounded-lg">
                  <Clock className="h-6 w-6 text-kutlwano-teal" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Long-Term (AOD)</p>
                  <p className="text-2xl font-bold text-warning">{longTermAgreements.length}</p>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agreements Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({agreements.length})</TabsTrigger>
            <TabsTrigger value="short-term">Short-Term ({shortTermAgreements.length})</TabsTrigger>
            <TabsTrigger value="long-term">Long-Term AOD ({longTermAgreements.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>All Agreements</CardTitle>
                <CardDescription>View all your signed agreements</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : agreements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No agreements found</p>
                  </div>
                ) : (
                  <AgreementTable items={agreements} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="short-term" className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Short-Term Agreements</CardTitle>
                <CardDescription>Agreements with 6 months or less duration</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : shortTermAgreements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No short-term agreements found</p>
                  </div>
                ) : (
                  <AgreementTable items={shortTermAgreements} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="long-term" className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Long-Term AOD Agreements</CardTitle>
                <CardDescription>Acknowledgement of Debt agreements longer than 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : longTermAgreements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No long-term AOD agreements found</p>
                  </div>
                ) : (
                  <AgreementTable items={longTermAgreements} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyAgreements;
