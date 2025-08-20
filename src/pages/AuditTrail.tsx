import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Filter, History, User, Clock, FileText } from 'lucide-react';
import { useAuditTrail } from '@/hooks/useAuditTrail';
import { format } from 'date-fns';

export const AuditTrail = () => {
  const [searchParams] = useSearchParams();
  const functionArea = searchParams.get('area') || 'all';
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  
  const { auditLogs, loading, fetchAuditLogs, getActionColor, getFunctionAreaLabel } = useAuditTrail();

  useEffect(() => {
    fetchAuditLogs(functionArea === 'all' ? undefined : functionArea);
  }, [functionArea]);

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const formatChangedFields = (changedFields: any) => {
    if (!changedFields || typeof changedFields !== 'object') return null;
    
    return Object.entries(changedFields).map(([field, changes]: [string, any]) => (
      <div key={field} className="text-xs space-y-1">
        <span className="font-medium text-muted-foreground">{field}:</span>
        <div className="pl-2 border-l-2 border-muted">
          <div className="text-red-600">- {changes.old || 'null'}</div>
          <div className="text-green-600">+ {changes.new || 'null'}</div>
        </div>
      </div>
    ));
  };

  return (
    <>
      <Helmet>
        <title>Audit Trail - Kutlwano Legal Management</title>
        <meta name="description" content="Track changes and activities across core management functions" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">
                  Audit Trail
                  {functionArea !== 'all' && (
                    <span className="text-lg font-medium text-muted-foreground ml-2">
                      - {getFunctionAreaLabel(functionArea)}
                    </span>
                  )}
                </h1>
              </div>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user, description, or table..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Action Type</label>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Function Area</label>
                  <Select value={functionArea} onValueChange={(value) => {
                    const params = new URLSearchParams();
                    if (value !== 'all') params.set('area', value);
                    window.history.replaceState(null, '', `?${params.toString()}`);
                    fetchAuditLogs(value === 'all' ? undefined : value);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All functions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Functions</SelectItem>
                      <SelectItem value="claimant">Claimant Management</SelectItem>
                      <SelectItem value="attorney">Attorney Management</SelectItem>
                      <SelectItem value="expert">Medical Expert</SelectItem>
                      <SelectItem value="assessment">Assessment Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Activity Log</span>
                <Badge variant="secondary">{filteredLogs.length} records</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading audit logs...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No audit logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Function Area</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Changes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm">
                                <div>{format(new Date(log.created_at), 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(log.created_at), 'HH:mm:ss')}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{log.user_email || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="outline">
                              {getFunctionAreaLabel(log.function_area)}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={`${getActionColor(log.action_type)} border-0`}>
                              {log.action_type}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {log.table_name}
                            </code>
                          </TableCell>
                          
                          <TableCell>
                            <div className="max-w-xs truncate text-sm">
                              {log.description || '-'}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            {log.changed_fields && Object.keys(log.changed_fields).length > 0 ? (
                              <div className="max-w-xs">
                                {formatChangedFields(log.changed_fields)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};