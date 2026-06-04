import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
}

const WelcomeSection = ({ onRefresh, refreshing }: Props) => (
  <div className="text-center space-y-4">
    <div className="inline-flex items-center space-x-2 bg-gradient-card px-4 py-2 rounded-full border border-border/50">
      <Clock className="h-4 w-4 text-kutlwano-blue" />
      <span className="text-sm text-muted-foreground">
        Last updated:{" "}
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
    </div>
    <div className="flex items-center justify-center gap-3">
      <h2 className="text-4xl font-bold text-foreground">Medico-Legal System</h2>
      <Button
        size="sm"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
      Comprehensive medico-legal assessment management dashboard with real-time insights
    </p>
    <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
  </div>
);

export default WelcomeSection;
