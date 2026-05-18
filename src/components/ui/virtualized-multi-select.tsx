import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface VMSOption {
  id: string;
  label: string;
}

interface Props {
  options: VMSOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholderAll?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  width?: number;
  rowHeight?: number;
  listHeight?: number;
}

export const VirtualizedMultiSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholderAll = 'All',
  searchPlaceholder = 'Search…',
  emptyText = 'No results',
  width = 320,
  rowHeight = 32,
  listHeight = 256,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const triggerLabel =
    value.length === 0
      ? placeholderAll
      : value.length === 1
        ? (options.find(o => o.id === value[0])?.label ?? '1 selected')
        : `${value.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="justify-between font-normal">
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width }}>
        <div className="p-2 border-b">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 text-xs border-b bg-muted/30">
          <span className="text-muted-foreground">
            {value.length} of {options.length} selected
            {search && ` · ${filtered.length} shown`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onChange(filtered.map(o => o.id))}
            >Select all</button>
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >Clear</button>
          </div>
        </div>
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: listHeight }}
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const opt = filtered[vi.index];
                const checked = valueSet.has(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="absolute left-0 right-0 flex items-center gap-2 px-3 rounded-sm hover:bg-accent cursor-pointer text-sm"
                    style={{
                      top: 0,
                      transform: `translateY(${vi.start}px)`,
                      height: vi.size,
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        onChange(
                          v
                            ? [...value, opt.id]
                            : value.filter(x => x !== opt.id)
                        );
                      }}
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
