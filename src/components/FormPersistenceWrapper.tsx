import React, { useEffect, ReactNode } from 'react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { ChangeHistoryDialog } from './ChangeHistoryDialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  lastSaved: Date | null;
  unsavedFields: string[];
  error: string | null;
}

interface FormPersistenceWrapperProps {
  children: ReactNode;
  saveState: SaveState;
  changeHistory: FieldChange[];
  onSave: () => Promise<boolean>;
  onRevert?: () => void;
  hasUnsavedChanges: boolean;
  showHeader?: boolean;
  title?: string;
  className?: string;
}

export const FormPersistenceWrapper: React.FC<FormPersistenceWrapperProps> = ({
  children,
  saveState,
  changeHistory,
  onSave,
  onRevert,
  hasUnsavedChanges,
  showHeader = true,
  title,
  className
}) => {
  const { triggerSync } = useAppointmentSync();

  // Trigger global sync when save is successful
  useEffect(() => {
    if (saveState.status === 'saved') {
      triggerSync();
    }
  }, [saveState.status, triggerSync]);

  return (
    <div className={cn('relative', className)}>
      {showHeader && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-4">
          <div className="flex items-center justify-between py-3 px-1">
            <div className="flex items-center gap-3">
              {title && (
                <h3 className="font-medium text-sm text-muted-foreground">{title}</h3>
              )}
              <SaveStatusIndicator
                status={saveState.status}
                lastSaved={saveState.lastSaved}
                unsavedFields={saveState.unsavedFields}
                error={saveState.error}
                showUnsavedFields
              />
            </div>
            
            <div className="flex items-center gap-2">
              <ChangeHistoryDialog changeHistory={changeHistory} />
              
              {onRevert && hasUnsavedChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRevert}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Revert
                </Button>
              )}
              
              <Button
                variant={hasUnsavedChanges ? 'default' : 'outline'}
                size="sm"
                onClick={onSave}
                disabled={saveState.status === 'saving' || !hasUnsavedChanges}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saveState.status === 'saving' ? 'Saving...' : 'Save Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {children}
      
      {/* Floating save indicator for mobile */}
      <div className="fixed bottom-4 right-4 z-50 md:hidden">
        {hasUnsavedChanges && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={saveState.status === 'saving'}
            className="shadow-lg gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        )}
      </div>
    </div>
  );
};

export default FormPersistenceWrapper;
