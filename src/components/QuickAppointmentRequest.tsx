import React from "react";
import { Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface ResponseRating {
  response_rating: string;
  response_time_hours: number;
}

interface QuickAppointmentRequestProps {
  lawFirmName?: string;
  recentResponseRating?: ResponseRating;
}

const QuickAppointmentRequest: React.FC<QuickAppointmentRequestProps> = ({ 
  lawFirmName, 
  recentResponseRating 
}) => {
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'average':
        return 'bg-yellow-500';
      case 'slow':
        return 'bg-orange-500';
      case 'very_slow':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRatingText = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'Excellent Response';
      case 'good':
        return 'Good Response';
      case 'average':
        return 'Average Response';
      case 'slow':
        return 'Slow Response';
      case 'very_slow':
        return 'Very Slow Response';
      default:
        return 'No Rating';
    }
  };

  const formatResponseTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      return `${Math.round(hours / 24)} days`;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          Quick Actions - Request Appointment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">
              Request a new medical expert appointment{lawFirmName ? ` for ${lawFirmName}` : ''}
            </p>
            {recentResponseRating && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>Our recent response time:</span>
                <Badge 
                  className={`${getRatingColor(recentResponseRating.response_rating)} text-white`}
                >
                  {getRatingText(recentResponseRating.response_rating)}
                </Badge>
                <span className="text-muted-foreground">
                  ({formatResponseTime(recentResponseRating.response_time_hours)})
                </span>
              </div>
            )}
            {!recentResponseRating && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="text-muted-foreground">
                  We typically respond within 2-8 hours
                </span>
              </div>
            )}
          </div>
          <Button asChild className="whitespace-nowrap">
            <Link to="/appointment-request">
              <Calendar className="h-4 w-4 mr-2" />
              Request New Appointment
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickAppointmentRequest;