import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

interface ChangeHistoryDialogProps {
  changeHistory: FieldChange[];
  title?: string;
}

export const ChangeHistoryDialog: React.FC<ChangeHistoryDialogProps> = ({
  changeHistory,
  title = 'Change History'
}) => {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Group changes by field
  const groupedChanges = changeHistory.reduce((acc, change) => {
    if (!acc[change.field]) {
      acc[change.field] = [];
    }
    acc[change.field].push(change);
    return acc;
  }, {} as Record<string, FieldChange[]>);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          View History
          {changeHistory.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {changeHistory.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Track all changes made to this record during the current session.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          {changeHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No changes recorded yet.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Changes will appear here as you edit fields.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedChanges).map(([field, changes]) => (
                <div key={field} className="border rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-3 text-primary">
                    {formatFieldName(field)}
                  </h4>
                  <div className="space-y-3">
                    {changes.map((change, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 text-sm bg-muted/50 rounded-md p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground line-through truncate max-w-[200px]">
                              {formatValue(change.oldValue)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {formatValue(change.newValue)}
                            </span>
                          </div>
                        </div>
                        <time className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(change.timestamp, 'HH:mm:ss')}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeHistoryDialog;
