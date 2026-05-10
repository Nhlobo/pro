import * as React from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  numberOfMonths?: number;
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
}

/**
 * Reusable date range picker. Apply across pages that filter by a date column.
 * Pair with the helper `isWithinDateRange` below when filtering arrays.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date range',
  align = 'end',
  className,
  numberOfMonths = 2,
  size = 'sm',
  disabled,
}: DateRangePickerProps) {
  const label = value?.from
    ? `${format(value.from, 'dd MMM yyyy')}${value.to ? ` – ${format(value.to, 'dd MMM yyyy')}` : ''}`
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className={cn(
            'gap-2 justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{label}</span>
          {value?.from && (
            <X
              className="h-3 w-3 ml-1 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={numberOfMonths}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Returns true if `dateStr` falls within the inclusive range (or no range is set).
 * Range filters are applied at day granularity (start of `from`, end of `to`).
 */
export function isWithinDateRange(dateStr?: string | null | Date, range?: DateRange): boolean {
  if (!range?.from && !range?.to) return true;
  if (!dateStr) return false;
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (range?.from) {
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    if (d < start) return false;
  }
  if (range?.to) {
    const end = new Date(range.to);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}
