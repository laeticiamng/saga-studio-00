import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, Circle } from "lucide-react";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyze Audio" },
  { key: "planning", label: "Plan Shots" },
  { key: "generating", label: "Generate Shots" },
  { key: "stitching", label: "Stitch & Export" },
  { key: "completed", label: "Done" },
];

const STATUS_ORDER = ["draft", "analyzing", "planning", "generating", "stitching", "completed", "failed"];

export function PipelineProgress({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {PIPELINE_STEPS.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const isDone = currentIdx > stepIdx;
        const isCurrent = status === step.key;
        const isFailed = status === "failed";

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              isDone && "bg-green-500/10 text-green-500",
              isCurrent && !isFailed && "bg-primary/10 text-primary",
              !isDone && !isCurrent && "bg-secondary text-muted-foreground",
              isFailed && isCurrent && "bg-destructive/10 text-destructive"
            )}>
              {isDone ? <CheckCircle className="h-4 w-4" /> : isCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
              {step.label}
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={cn("h-px w-6", isDone ? "bg-green-500/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
