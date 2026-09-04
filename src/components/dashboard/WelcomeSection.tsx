import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
}

const WelcomeSection = ({ onRefresh, refreshing }: Props) => (
  <div className="text-center space-y-4">
    <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-none border border-black/10 bg-white px-3 py-2 sm:px-4">
      <Clock className="h-4 w-4 shrink-0 text-kutlwano-teal" />
      <span className="text-xs text-muted-foreground sm:text-sm">
        Last updated:{" "}
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <h2 className="text-2xl font-bold text-foreground break-words sm:text-3xl md:text-4xl">Medico-Legal System</h2>
      <Button
        size="sm"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex shrink-0 items-center gap-2 rounded-none"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
    <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto px-2">
      Comprehensive medico-legal assessment management dashboard with real-time insights
    </p>
    <div className="w-24 h-0.5 bg-kutlwano-teal mx-auto"></div>
  </div>
);

export default WelcomeSection;
