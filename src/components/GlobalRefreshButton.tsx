import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const GlobalRefreshButton = () => {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast({
        title: "Page Refreshed",
        description: "Data has been refreshed successfully.",
      });
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          className="fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full shadow-lg border bg-background hover:bg-muted transition-all"
          aria-label="Refresh page data"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Refresh data</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default GlobalRefreshButton;
