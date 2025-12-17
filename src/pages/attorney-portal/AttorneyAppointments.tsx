import React, { useState, useMemo } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  Download,
  Filter,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO } from 'date-fns';

const AttorneyAppointments: React.FC = () => {
  const { liveCases, loading } = useAttorneyDashboardStats();
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  // Group appointments by date
  const groupedAppointments = useMemo(() => {
    let filtered = [...liveCases];
    
    // Apply period filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(c => {
        const date = new Date(c.appointmentDate);
        switch (filterPeriod) {
          case 'today':
            return isToday(date);
          case 'tomorrow':
            return isTomorrow(date);
          case 'week':
            return isThisWeek(date);
          case 'month':
            return isThisMonth(date);
          case 'upcoming':
            return date >= now;
          case 'past':
            return date < now;
          default:
            return true;
        }
      });
    }

    // Sort by date
    filtered.sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

    // Group by date
    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(appointment => {
      const dateKey = format(new Date(appointment.appointmentDate), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(appointment);
    });

    return grouped;
  }, [liveCases, filterPeriod]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, dd MMMM yyyy');
  };

  const todayCount = liveCases.filter(c => isToday(new Date(c.appointmentDate))).length;
  const upcomingCount = liveCases.filter(c => new Date(c.appointmentDate) >= new Date()).length;

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-8 w-8 text-kutlwano-blue" />
              Appointments
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage your scheduled appointments
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold text-kutlwano-blue">{todayCount}</p>
                </div>
                <div className="p-3 bg-kutlwano-blue/10 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-kutlwano-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold text-kutlwano-teal">{upcomingCount}</p>
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
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">{liveCases.length}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Appointments</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="upcoming">Upcoming Only</SelectItem>
                  <SelectItem value="past">Past Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : Object.keys(groupedAppointments).length === 0 ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No appointments found for the selected period</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {Object.entries(groupedAppointments).map(([dateKey, appointments]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary rounded-lg">
                      <CalendarDays className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{getDateLabel(dateKey)}</h3>
                      <p className="text-xs text-muted-foreground">{appointments.length} appointment(s)</p>
                    </div>
                  </div>

                  {/* Appointments for this date */}
                  <div className="space-y-3 ml-6 border-l-2 border-border pl-6">
                    {appointments.map((appointment, index) => (
                      <Card key={index} className="bg-gradient-card border-border/50 hover:shadow-soft transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-kutlwano-blue" />
                                <span className="font-medium text-foreground">{appointment.claimantName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{appointment.expertType}</span>
                                <Badge variant="outline" className="ml-2">Medical Expert</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{format(new Date(appointment.appointmentDate), 'HH:mm')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                Letter
                              </Button>
                              <Button variant="ghost" size="sm">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyAppointments;
