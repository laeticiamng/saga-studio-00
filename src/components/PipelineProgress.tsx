import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CheckCircle, Loader2, Circle, AlertCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyse audio", shortLabel: "Analyse", avgSec: 15 },
  { key: "planning", label: "Planification", shortLabel: "Plan", avgSec: 20 },
  { key: "generating", label: "Génération", shortLabel: "Génération", avgSec: 120 },
  { key: "stitching", label: "Assemblage", shortLabel: "Assemblage", avgSec: 30 },
  { key: "completed", label: "Terminé", shortLabel: "Terminé", avgSec: 0 },
];

const STATUS_ORDER = ["draft", "analyzing", "planning", "generating", "stitching", "completed", "failed"];

interface PipelineProgressProps {
  status: string;
  completedShots?: number;
  totalShots?: number;
}

function formatETA(seconds: number): string {
  if (seconds <= 0) return "presque terminé";
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

  useEffect(() => {
    if (!isActive) { setElapsedSec(0); return; }
    setElapsedSec(0);
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status, isActive]);

  const currentStep = PIPELINE_STEPS.find(s => s.key === status);
  const remainingSteps = PIPELINE_STEPS.filter(s => STATUS_ORDER.indexOf(s.key) > currentIdx && s.key !== "completed");
  
  let etaSeconds = 0;
  if (currentStep && isActive) {
    if (status === "generating" && totalShots > 0) {
      const perShotSec = completedShots > 0 ? (elapsedSec / completedShots) : 8;
      etaSeconds = (totalShots - completedShots) * perShotSec;
    } else {
      etaSeconds = Math.max(0, currentStep.avgSec - elapsedSec);
    }
    etaSeconds += remainingSteps.reduce((sum, s) => sum + s.avgSec, 0);
  }

  const shotPercent = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;

  // Overall progress percentage for the full bar
  const totalSteps = PIPELINE_STEPS.length;
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.key === status);
  let overallPercent = 0;
  if (status === "completed") {
    overallPercent = 100;
  } else if (currentStepIdx >= 0) {
    const basePercent = (currentStepIdx / totalSteps) * 100;
    const stepWeight = 100 / totalSteps;
    if (status === "generating" && totalShots > 0) {
      overallPercent = basePercent + (shotPercent / 100) * stepWeight;
    } else if (currentStep) {
      const stepProgress = currentStep.avgSec > 0 ? Math.min(1, elapsedSec / currentStep.avgSec) : 0.5;
      overallPercent = basePercent + stepProgress * stepWeight;
    }
  }

  return (
    <Card className="border-border/50 bg-card/60 p-5 sm:p-6 space-y-5">
      {/* Steps Row */}
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STATUS_ORDER.indexOf(step.key);
          const isDone = currentIdx > stepIdx;
          const isCurrent = status === step.key;

          return (
            <div key={step.key} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div className={cn(
                  "flex items-center justify-center rounded-full h-8 w-8 sm:h-9 sm:w-9 transition-all duration-300 shrink-0",
                  isDone && "bg-green-500/15 text-green-500",
                  isCurrent && !isFailed && "bg-primary/15 text-primary ring-2 ring-primary/20",
                  isCurrent && isFailed && "bg-destructive/15 text-destructive ring-2 ring-destructive/20",
                  !isDone && !isCurrent && "bg-secondary text-muted-foreground/50"
                )}>
                  {isDone ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isCurrent && !isFailed ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFailed ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] sm:text-xs font-medium text-center whitespace-nowrap transition-colors",
                  isDone && "text-green-500",
                  isCurrent && !isFailed && "text-foreground",
                  isCurrent && isFailed && "text-destructive",
                  !isDone && !isCurrent && "text-muted-foreground/60"
                )}>
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
                {step.key === "generating" && (isCurrent || isDone) && totalShots > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {completedShots}/{totalShots}
                  </span>
                )}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-1 transition-colors",
                  isDone ? "bg-green-500/40" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      {(isActive || status === "completed") && (
        <div className="space-y-2">
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                status === "completed" ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>
          {isActive && etaSeconds > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Temps restant : {formatETA(etaSeconds)}
              </span>
              {status === "generating" && totalShots > 0 && (
                <span className="font-medium text-primary">{shotPercent}%</span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Card import for wrapping
import { Card } from "@/components/ui/card";
