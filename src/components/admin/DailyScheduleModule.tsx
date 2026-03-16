import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, MapPin } from 'lucide-react';

const mockSchedule = [
  { time: '08:00', claimant: 'J. Mokoena', expert: 'Dr. Smith', type: 'RAF', venue: 'Sandton', status: 'confirmed' },
  { time: '09:30', claimant: 'S. Naidoo', expert: 'Dr. Patel', type: 'Med Neg', venue: 'Durban', status: 'confirmed' },
  { time: '10:00', claimant: 'M. van der Berg', expert: 'Dr. Jones', type: 'RAF', venue: 'Cape Town', status: 'pending' },
  { time: '11:30', claimant: 'T. Dlamini', expert: 'Dr. Nkosi', type: 'RAF', venue: 'Pretoria', status: 'confirmed' },
  { time: '14:00', claimant: 'R. Pillay', expert: 'Dr. Williams', type: 'Med Neg', venue: 'Johannesburg', status: 'rescheduled' },
];

const DailyScheduleModule: React.FC = () => {
  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-primary">{mockSchedule.length}</p>
            <p className="text-xs text-muted-foreground">Today's Appointments</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-success">{mockSchedule.filter(s => s.status === 'confirmed').length}</p>
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-warning">{mockSchedule.filter(s => s.status !== 'confirmed').length}</p>
            <p className="text-xs text-muted-foreground">Needs Attention</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockSchedule.map((appt, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg border border-border/30">
              <div className="text-center min-w-[60px]">
                <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{appt.time}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{appt.claimant}</p>
                <p className="text-xs text-muted-foreground">{appt.expert} · {appt.type}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {appt.venue}
              </div>
              <Badge className={`text-[10px] ${
                appt.status === 'confirmed' ? 'bg-success/10 text-success' :
                appt.status === 'rescheduled' ? 'bg-warning/10 text-warning' :
                'bg-muted text-muted-foreground'
              }`}>
                {appt.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyScheduleModule;
