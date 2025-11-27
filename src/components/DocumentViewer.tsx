import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Change {
  type: string;
  original: string;
  corrected: string;
  line: number;
  reason: string;
  position?: number;
}

interface DocumentViewerProps {
  text: string;
  changes: Change[];
  showCorrections?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  text,
  changes,
  showCorrections = false,
}) => {
  const highlightedContent = useMemo(() => {
    if (!changes || changes.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
    }

    // Sort changes by position to process them in order
    const sortedChanges = [...changes].sort((a, b) => {
      const posA = text.indexOf(a.original);
      const posB = text.indexOf(b.original);
      return posA - posB;
    });

    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    sortedChanges.forEach((change, idx) => {
      const position = text.indexOf(change.original, lastIndex);
      
      if (position === -1 || position < lastIndex) {
        return; // Skip if not found or already processed
      }

      // Add text before the error
      if (position > lastIndex) {
        elements.push(
          <span key={`text-${idx}`}>
            {text.substring(lastIndex, position)}
          </span>
        );
      }

      // Add highlighted error with tooltip
      const errorColor = {
        spelling: "bg-red-200 hover:bg-red-300",
        grammar: "bg-yellow-200 hover:bg-yellow-300",
        medical: "bg-purple-200 hover:bg-purple-300",
        formatting: "bg-blue-200 hover:bg-blue-300",
        repetition: "bg-orange-200 hover:bg-orange-300",
        other: "bg-gray-200 hover:bg-gray-300",
      }[change.type] || "bg-gray-200 hover:bg-gray-300";

      elements.push(
        <TooltipProvider key={`error-${idx}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <mark
                className={`${errorColor} cursor-help rounded px-0.5 transition-colors relative inline-block`}
              >
                {showCorrections ? change.corrected : change.original}
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 px-1 text-[10px] pointer-events-none"
                >
                  {change.type[0].toUpperCase()}
                </Badge>
              </mark>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <div className="font-semibold capitalize">{change.type} Error</div>
                <div className="text-xs">
                  <span className="text-red-500">Original:</span> {change.original}
                </div>
                <div className="text-xs">
                  <span className="text-green-500">Corrected:</span> {change.corrected}
                </div>
                <div className="text-xs text-muted-foreground italic">{change.reason}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      lastIndex = position + change.original.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key="text-end">{text.substring(lastIndex)}</span>
      );
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{elements}</div>;
  }, [text, changes, showCorrections]);

  return (
    <Card className="p-6 max-h-[600px] overflow-y-auto">
      <div className="prose max-w-none">
        {highlightedContent}
      </div>
      
      {changes && changes.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 rounded"></div>
              <span className="text-xs text-muted-foreground">Spelling</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-200 rounded"></div>
              <span className="text-xs text-muted-foreground">Grammar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-200 rounded"></div>
              <span className="text-xs text-muted-foreground">Medical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span className="text-xs text-muted-foreground">Formatting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded"></div>
              <span className="text-xs text-muted-foreground">Repetition</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
