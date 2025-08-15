import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { Calendar, FileText, Printer, Download, ChevronLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

type TimePeriod = "week" | "month" | "quarter" | "year";

interface ClaimantData {
  id: string;
  first_name: string;
  last_name: string;
  contact_number: string | null;
  auto_id: string;
  created_at: string;
  law_firm: {
    id: string;
    name: string;
    contact_person: string | null;
  };
}

interface GroupedClaimants {
  [lawFirmId: string]: {
    lawFirm: ClaimantData['law_firm'];
    claimants: ClaimantData[];
    count: number;
  };
}

const ClaimantReports: React.FC = () => {
  const { toast } = useToast();
  const [claimants, setClaimants] = useState<ClaimantData[]>([]);
  const [groupedClaimants, setGroupedClaimants] = useState<GroupedClaimants>({});
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchClaimants = async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on selected period
      let startDate: Date;
      let endDate: Date;
      
      switch (timePeriod) {
        case "week":
          startDate = startOfWeek(selectedDate);
          endDate = endOfWeek(selectedDate);
          break;
        case "month":
          startDate = startOfMonth(selectedDate);
          endDate = endOfMonth(selectedDate);
          break;
        case "quarter":
          startDate = startOfQuarter(selectedDate);
          endDate = endOfQuarter(selectedDate);
          break;
        case "year":
          startDate = startOfYear(selectedDate);
          endDate = endOfYear(selectedDate);
          break;
      }

      const { data, error } = await supabase
        .from("claimants")
        .select(`
          id,
          first_name,
          last_name,
          contact_number,
          auto_id,
          created_at,
          law_firm:law_firms!law_firm_id(
            id,
            name,
            contact_person
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const claimantsData = data as ClaimantData[];
      setClaimants(claimantsData);

      // Group claimants by law firm
      const grouped = claimantsData.reduce((acc, claimant) => {
        const lawFirmId = claimant.law_firm.id;
        if (!acc[lawFirmId]) {
          acc[lawFirmId] = {
            lawFirm: claimant.law_firm,
            claimants: [],
            count: 0
          };
        }
        acc[lawFirmId].claimants.push(claimant);
        acc[lawFirmId].count++;
        return acc;
      }, {} as GroupedClaimants);

      setGroupedClaimants(grouped);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch claimants",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimants();
  }, [timePeriod, selectedDate]);

  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadPDF = () => {
    // For PDF generation, we'll use the browser's print to PDF functionality
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      // The user can then use Ctrl+P and select "Save as PDF"
      setTimeout(() => {
        printWindow.print();
      }, 100);
    }
  };

  const generatePrintContent = () => {
    const periodLabel = timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1);
    const dateLabel = format(selectedDate, 'MMMM yyyy');
    const totalClaimants = claimants.length;
    const totalLawFirms = Object.keys(groupedClaimants).length;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Claimant Report - ${periodLabel} ${dateLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .summary-item { text-align: center; }
            .law-firm-section { margin-bottom: 30px; page-break-inside: avoid; }
            .law-firm-header { background-color: #f5f5f5; padding: 10px; font-weight: bold; border: 1px solid #ddd; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f9f9f9; }
            .no-data { text-align: center; font-style: italic; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Claimant Report</h1>
            <h2>${periodLabel} Report for ${dateLabel}</h2>
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>${totalClaimants}</h3>
              <p>Total Claimants</p>
            </div>
            <div class="summary-item">
              <h3>${totalLawFirms}</h3>
              <p>Law Firms</p>
            </div>
          </div>

          ${Object.values(groupedClaimants).map(group => `
            <div class="law-firm-section">
              <div class="law-firm-header">
                ${group.lawFirm.name} (${group.count} claimants)
                ${group.lawFirm.contact_person ? ` - Contact: ${group.lawFirm.contact_person}` : ''}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Auto ID</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.claimants.map(claimant => `
                    <tr>
                      <td>${claimant.auto_id}</td>
                      <td>${claimant.first_name} ${claimant.last_name}</td>
                      <td>${claimant.contact_number || 'N/A'}</td>
                      <td>${format(new Date(claimant.created_at), 'MMM dd, yyyy')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}

          ${totalClaimants === 0 ? '<div class="no-data">No claimants found for the selected period.</div>' : ''}
        </body>
      </html>
    `;
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/claimant-reports';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Claimant Reports | Medico-Legal</title>
        <meta name="description" content="View and generate claimant reports grouped by referring attorney with time-based filtering and export options." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Claimant Reports</h1>
              <p className="text-muted-foreground mt-2">View claimants grouped by referring attorney with time-based filtering.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-sm font-medium mb-2 block">Time Period</label>
                <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <input
                  type="month"
                  value={format(selectedDate, 'yyyy-MM')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value + '-01'))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{claimants.length}</div>
              <p className="text-sm text-muted-foreground">Total Claimants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{Object.keys(groupedClaimants).length}</div>
              <p className="text-sm text-muted-foreground">Law Firms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {claimants.length > 0 ? (claimants.length / Math.max(Object.keys(groupedClaimants).length, 1)).toFixed(1) : '0'}
              </div>
              <p className="text-sm text-muted-foreground">Avg per Firm</p>
            </CardContent>
          </Card>
        </div>

        {/* Claimants by Law Firm */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading claimant data...</div>
            </CardContent>
          </Card>
        ) : Object.keys(groupedClaimants).length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No claimants found for the selected time period.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedClaimants).map((group) => (
              <Card key={group.lawFirm.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{group.lawFirm.name}</h3>
                      {group.lawFirm.contact_person && (
                        <p className="text-sm text-muted-foreground">Contact: {group.lawFirm.contact_person}</p>
                      )}
                    </div>
                    <div className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                      {group.count} claimant{group.count !== 1 ? 's' : ''}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auto ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Date Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.claimants.map((claimant) => (
                        <TableRow key={claimant.id}>
                          <TableCell className="font-mono">{claimant.auto_id}</TableCell>
                          <TableCell>{claimant.first_name} {claimant.last_name}</TableCell>
                          <TableCell>{claimant.contact_number || 'N/A'}</TableCell>
                          <TableCell>{format(new Date(claimant.created_at), 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClaimantReports;