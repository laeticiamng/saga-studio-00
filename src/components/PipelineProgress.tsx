import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, Circle, AlertCircle } from "lucide-react";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyze Audio" },
  { key: "planning", label: "Plan Shots" },
  { key: "generating", label: "Generate Shots" },
  { key: "stitching", label: "Stitch & Export" },
  { key: "completed", label: "Done" },
];

const STATUS_ORDER = ["draft", "analyzing", "planning", "generating", "stitching", "completed", "failed"];

interface PipelineProgressProps {
  status: string;
  completedShots?: number;
  totalShots?: number;
}

export function PipelineProgress({ status, completedShots = 0, totalShots = 0 }: PipelineProgressProps) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  const isFailed = status === "failed";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STATUS_ORDER.indexOf(step.key);
          const isDone = currentIdx > stepIdx;
          const isCurrent = status === step.key;

          return (
            <div key={step.key} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                isDone && "bg-green-500/10 text-green-500",
                isCurrent && !isFailed && "bg-primary/10 text-primary",
                !isDone && !isCurrent && "bg-secondary text-muted-foreground",
                isFailed && "bg-destructive/10 text-destructive"
              )}>
                {isDone ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isCurrent && !isFailed ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFailed ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {step.label}
                {/* Show shot progress during generation */}
                {step.key === "generating" && (isCurrent || isDone) && totalShots > 0 && (
                  <span className="ml-1 text-xs opacity-75">
                    ({completedShots}/{totalShots})
                  </span>
                )}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={cn("h-px w-6 shrink-0", isDone ? "bg-green-500/50" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar during generation */}
      {status === "generating" && totalShots > 0 && (
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.round((completedShots / totalShots) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
