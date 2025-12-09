import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Check, 
  X, 
  Search, 
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import CompanyFooter from '@/components/CompanyFooter';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useDocumentChecklist, REQUIRED_DOCUMENTS } from '@/hooks/useDocumentChecklist';

const DocumentChecklist = () => {
  const { claimants, loading, updateChecklistItem, refetch } = useDocumentChecklist();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'incomplete'>('all');

  const filteredClaimants = claimants.filter(claimant => {
    const matchesSearch = 
      claimant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claimant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claimant.auto_id.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'complete') {
      return matchesSearch && claimant.submittedCount === claimant.totalRequired;
    } else if (filterStatus === 'incomplete') {
      return matchesSearch && claimant.submittedCount < claimant.totalRequired;
    }
    return matchesSearch;
  });

  // Summary stats
  const totalClaimants = claimants.length;
  const completeClaimants = claimants.filter(c => c.submittedCount === c.totalRequired).length;
  const incompleteClaimants = totalClaimants - completeClaimants;

  const handleToggleDocument = async (claimantId: string, documentType: string, currentStatus: boolean) => {
    await updateChecklistItem(claimantId, documentType, !currentStatus);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Document Checklist - Medico-Legal Assessment System</title>
          <meta name="description" content="Track required documents for all claimants. Monitor ID, medical records, hospital files, police reports, RAF forms, and affidavits submission status." />
        </Helmet>

        <header className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
          <div className="container mx-auto px-4 py-10">
            <div className="relative">
              <Link to="/dashboard" className="inline-block mb-4">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <FileText className="h-8 w-8 text-kutlwano-blue" />
                Document Upload Checklist
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Track required documents for each claimant. Green check means submitted, red X means missing.
              </p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Claimants</p>
                    <p className="text-2xl font-bold">{totalClaimants}</p>
                  </div>
                  <FileText className="h-8 w-8 text-kutlwano-blue opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Complete</p>
                    <p className="text-2xl font-bold text-success">{completeClaimants}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-success opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Missing Documents</p>
                    <p className="text-2xl font-bold text-destructive">{incompleteClaimants}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-destructive opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by claimant name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Claimants</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="incomplete">Missing Docs</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={refetch} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Link to="/document-upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Document Legend */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Required Documents</CardTitle>
              <CardDescription>Each claimant requires the following documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {REQUIRED_DOCUMENTS.map((doc) => (
                  <TooltipProvider key={doc.type}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 rounded-lg bg-muted/30 text-center cursor-help">
                          <FileText className="h-5 w-5 mx-auto mb-1 text-kutlwano-blue" />
                          <p className="text-xs font-medium">{doc.label}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{doc.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Checklist Table */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Document Status by Claimant</CardTitle>
              <CardDescription>
                Click checkboxes to toggle document status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClaimants.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Claimants Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Try adjusting your search terms' : 'No claimants in the system yet'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Claimant</TableHead>
                        <TableHead className="text-center">Progress</TableHead>
                        {REQUIRED_DOCUMENTS.map((doc) => (
                          <TableHead key={doc.type} className="text-center w-[80px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  <span className="text-xs">{doc.label.split(' ')[0]}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{doc.label}</p>
                                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClaimants.map((claimant) => (
                        <TableRow key={claimant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{claimant.first_name} {claimant.last_name}</p>
                              <p className="text-xs text-muted-foreground">{claimant.auto_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(claimant.submittedCount / claimant.totalRequired) * 100} 
                                className="h-2 w-20"
                              />
                              <span className="text-xs text-muted-foreground">
                                {claimant.submittedCount}/{claimant.totalRequired}
                              </span>
                            </div>
                          </TableCell>
                          {claimant.checklist.map((item) => {
                            const docInfo = REQUIRED_DOCUMENTS.find(d => d.type === item.document_type);
                            return (
                              <TableCell key={item.document_type} className="text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div 
                                        className="inline-flex items-center justify-center cursor-pointer"
                                        onClick={() => handleToggleDocument(claimant.id, item.document_type, item.is_submitted)}
                                      >
                                        {item.is_submitted ? (
                                          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                                            <Check className="h-5 w-5 text-success" />
                                          </div>
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                                            <X className="h-5 w-5 text-destructive" />
                                          </div>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{docInfo?.label}: {item.is_submitted ? 'Submitted' : 'Missing'}</p>
                                      <p className="text-xs">Click to toggle</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </main>

        <CompanyFooter />
      </div>
    </ProtectedRoute>
  );
};

export default DocumentChecklist;
