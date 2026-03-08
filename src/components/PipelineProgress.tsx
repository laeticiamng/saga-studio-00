import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, Circle, AlertCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyze Audio", avgSec: 15 },
  { key: "planning", label: "Plan Shots", avgSec: 20 },
  { key: "generating", label: "Generate Shots", avgSec: 120 },
  { key: "stitching", label: "Stitch & Export", avgSec: 30 },
  { key: "completed", label: "Done", avgSec: 0 },
];

const STATUS_ORDER = ["draft", "analyzing", "planning", "generating", "stitching", "completed", "failed"];

interface PipelineProgressProps {
  status: string;
  completedShots?: number;
  totalShots?: number;
}

function formatETA(seconds: number): string {
  if (seconds <= 0) return "almost done";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `~${m}m${s > 0 ? ` ${s}s` : ""}`;
}

export function PipelineProgress({ status, completedShots = 0, totalShots = 0 }: PipelineProgressProps) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  const isFailed = status === "failed";
  const isActive = ["analyzing", "planning", "generating", "stitching"].includes(status);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Timer for current step
  useEffect(() => {
    if (!isActive) { setElapsedSec(0); return; }
    setElapsedSec(0);
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status, isActive]);

  // Calculate ETA
  const currentStep = PIPELINE_STEPS.find(s => s.key === status);
  const remainingSteps = PIPELINE_STEPS.filter(s => STATUS_ORDER.indexOf(s.key) > currentIdx && s.key !== "completed");
  
  let etaSeconds = 0;
  if (currentStep && isActive) {
    // Current step remaining
    if (status === "generating" && totalShots > 0) {
      const perShotSec = completedShots > 0 ? (elapsedSec / completedShots) : 8;
      etaSeconds = (totalShots - completedShots) * perShotSec;
    } else {
      etaSeconds = Math.max(0, currentStep.avgSec - elapsedSec);
    }
    // Add future steps
    etaSeconds += remainingSteps.reduce((sum, s) => sum + s.avgSec, 0);
  }

  const shotPercent = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;

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
        <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${shotPercent}%` }}
          />
        </div>
      )}

      {/* ETA display */}
      {isActive && etaSeconds > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>ETA: {formatETA(etaSeconds)}</span>
          {status === "generating" && totalShots > 0 && (
            <span className="ml-auto font-medium text-primary">{shotPercent}%</span>
          )}
        </div>
      )}
    </div>
  );
}
