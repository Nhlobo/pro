import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useCaseSources } from '@/hooks/useCaseSources';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  PieChart as PieChartIcon, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus,
  Car,
  Stethoscope,
  HardHat,
  FileQuestion
} from 'lucide-react';
import { toast } from 'sonner';

const CaseSourcesAnalysis = () => {
  const { summary, caseSources, loading, createCaseSource } = useCaseSources();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCaseSource, setNewCaseSource] = useState({
    appointment_id: '',
    source_type: 'MVA' as 'MVA' | 'Medical Negligence' | 'Workers Compensation' | 'Other',
    source_details: '',
    assessment_date: new Date().toISOString().split('T')[0]
  });

  const sourceIcons = {
    'MVA': <Car className="h-4 w-4" />,
    'Medical Negligence': <Stethoscope className="h-4 w-4" />,
    'Workers Compensation': <HardHat className="h-4 w-4" />,
    'Other': <FileQuestion className="h-4 w-4" />
  };

  const sourceColors = {
    'MVA': '#3b82f6',
    'Medical Negligence': '#ef4444',
    'Workers Compensation': '#f59e0b',
    'Other': '#8b5cf6'
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleAddCaseSource = async () => {
    if (!newCaseSource.appointment_id || !newCaseSource.assessment_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const success = await createCaseSource(newCaseSource);
    if (success) {
      setIsAddDialogOpen(false);
      setNewCaseSource({
        appointment_id: '',
        source_type: 'MVA',
        source_details: '',
        assessment_date: new Date().toISOString().split('T')[0]
      });
    }
  };

  const pieChartData = summary.map(item => ({
    name: item.source_type,
    value: item.count,
    color: sourceColors[item.source_type as keyof typeof sourceColors]
  }));

  const barChartData = summary.map(item => ({
    name: item.source_type.split(' ')[0], // Abbreviated names for chart
    count: item.count,
    recent: item.recent_cases
  }));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((source) => (
          <Card key={source.source_type} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg text-white"
                    style={{ backgroundColor: sourceColors[source.source_type as keyof typeof sourceColors] }}
                  >
                    {sourceIcons[source.source_type as keyof typeof sourceIcons]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{source.source_type}</p>
                    <p className="text-2xl font-bold">{source.count}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1">
                    {getTrendIcon(source.trend)}
                    <span className="text-sm font-medium">{source.percentage}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {source.recent_cases} recent
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={source.percentage} 
                  className="h-2"
                  style={{ 
                    backgroundColor: `${sourceColors[source.source_type as keyof typeof sourceColors]}20` 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-kutlwano-blue" />
                Case Source Distribution
              </CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Case
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Case Source</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="appointment_id">Appointment ID</Label>
                      <Input
                        id="appointment_id"
                        value={newCaseSource.appointment_id}
                        onChange={(e) => setNewCaseSource(prev => ({ ...prev, appointment_id: e.target.value }))}
                        placeholder="Enter appointment ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="source_type">Case Source Type</Label>
                      <Select
                        value={newCaseSource.source_type}
                        onValueChange={(value) => setNewCaseSource(prev => ({ ...prev, source_type: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MVA">MVA (Motor Vehicle Accident)</SelectItem>
                          <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                          <SelectItem value="Workers Compensation">Workers Compensation</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assessment_date">Assessment Date</Label>
                      <Input
                        id="assessment_date"
                        type="date"
                        value={newCaseSource.assessment_date}
                        onChange={(e) => setNewCaseSource(prev => ({ ...prev, assessment_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="source_details">Additional Details (Optional)</Label>
                      <Textarea
                        id="source_details"
                        value={newCaseSource.source_details}
                        onChange={(e) => setNewCaseSource(prev => ({ ...prev, source_details: e.target.value }))}
                        placeholder="Enter additional details about this case source..."
                      />
                    </div>
                    <Button onClick={handleAddCaseSource} className="w-full">
                      Record Case Source
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No case source data available</p>
                </div>
              </div>
            )}
            
            {/* Legend */}
            {pieChartData.length > 0 && (
              <div className="mt-4 space-y-2">
                {pieChartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <Badge variant="secondary">{item.value} ({summary.find(s => s.source_type === item.name)?.percentage}%)</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-kutlwano-blue" />
              Total vs Recent Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="count" fill="hsl(var(--kutlwano-blue))" radius={[4, 4, 0, 0]} name="Total Cases" />
                    <Bar dataKey="recent" fill="hsl(var(--kutlwano-teal))" radius={[4, 4, 0, 0]} name="Recent (30 days)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No case data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal Sources Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Where We're Getting Our Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.map((source) => (
              <div key={source.source_type} className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="p-2 rounded-lg text-white"
                    style={{ backgroundColor: sourceColors[source.source_type as keyof typeof sourceColors] }}
                  >
                    {sourceIcons[source.source_type as keyof typeof sourceIcons]}
                  </div>
                  <div>
                    <h3 className="font-medium">{source.source_type}</h3>
                    <p className="text-sm text-muted-foreground">{source.percentage}% of total</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Cases:</span>
                    <span className="font-medium">{source.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Recent (30d):</span>
                    <span className="font-medium">{source.recent_cases}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Trend:</span>
                    {getTrendIcon(source.trend)}
                    <Badge 
                      variant="outline" 
                      className={
                        source.trend === 'up' ? 'text-green-600 border-green-200' :
                        source.trend === 'down' ? 'text-red-600 border-red-200' :
                        'text-gray-600 border-gray-200'
                      }
                    >
                      {source.trend}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseSourcesAnalysis;