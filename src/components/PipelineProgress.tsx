import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CheckCircle, Loader2, Circle, AlertCircle, Clock, Zap, Activity } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const PIPELINE_STEPS = [
  { key: "analyzing", fn: "analyze-audio", label: "Analyse audio", shortLabel: "Analyse", icon: Activity, avgSec: 15 },
  { key: "planning", fn: "plan-project", label: "Planification IA", shortLabel: "Plan", icon: Zap, avgSec: 25 },
  { key: "generating", fn: "generate-shots", label: "Génération vidéo", shortLabel: "Génération", icon: Loader2, avgSec: 120 },
  { key: "stitching", fn: "stitch-render", label: "Assemblage final", shortLabel: "Assemblage", icon: Loader2, avgSec: 30 },
  { key: "completed", fn: "", label: "Terminé", shortLabel: "Terminé", icon: CheckCircle, avgSec: 0 },
];

const STATUS_ORDER = ["draft", "analyzing", "planning", "generating", "stitching", "completed", "failed"];

interface JobRecord {
  id: string;
  step: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface PipelineProgressProps {
  projectId: string;
  status: string;
  completedShots?: number;
  totalShots?: number;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s > 0 ? `${s}s` : ""}`;
}

function formatETA(seconds: number): string {
  if (seconds <= 0) return "presque terminé…";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `~${m}m${s > 0 ? ` ${s}s` : ""}`;
}

export function PipelineProgress({ projectId, status, completedShots = 0, totalShots = 0 }: PipelineProgressProps) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  const isFailed = status === "failed";
  const isActive = ["analyzing", "planning", "generating", "stitching"].includes(status);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [now, setNow] = useState(Date.now());

  // Fetch job_queue records for this project
  useEffect(() => {
    if (!projectId) return;

    const fetchJobs = async () => {
      const { data } = await supabase
        .from("job_queue")
        .select("id, step, status, started_at, completed_at, error_message, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (data) setJobs(data as JobRecord[]);
    };

    fetchJobs();

    // Subscribe to realtime job_queue updates
    const channel = supabase
      .channel(`pipeline-jobs-${projectId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "job_queue",
        filter: `project_id=eq.${projectId}`,
      }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // Tick every second for live elapsed time
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Build step data from jobs
  const stepData = useMemo(() => {
    return PIPELINE_STEPS.map(step => {
      const job = jobs.find(j => j.step === step.fn);
      let elapsedSec = 0;
      let realDuration: number | null = null;

      if (job?.started_at && job?.completed_at) {
        realDuration = (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
        elapsedSec = realDuration;
      } else if (job?.started_at && !job?.completed_at) {
        elapsedSec = (now - new Date(job.started_at).getTime()) / 1000;
      }

      return {
        ...step,
        job,
        elapsedSec,
        realDuration,
        jobStatus: job?.status || null,
      };
    });
  }, [jobs, now]);

  // Current step info
  const currentStepData = stepData.find(s => s.key === status);
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.key === status);

  // ETA calculation using real data
  const etaSeconds = useMemo(() => {
    if (!isActive || !currentStepData) return 0;

    let currentRemaining = 0;
    if (status === "generating" && totalShots > 0) {
      const perShotSec = completedShots > 0
        ? (currentStepData.elapsedSec / completedShots)
        : 8;
      currentRemaining = (totalShots - completedShots) * perShotSec;
    } else {
      currentRemaining = Math.max(0, currentStepData.avgSec - currentStepData.elapsedSec);
    }

    // Use real durations for completed steps to better estimate remaining
    const remainingSteps = stepData.filter(s =>
      STATUS_ORDER.indexOf(s.key) > currentIdx && s.key !== "completed"
    );
    const futureEta = remainingSteps.reduce((sum, s) => sum + s.avgSec, 0);

    return currentRemaining + futureEta;
  }, [status, isActive, currentStepData, completedShots, totalShots, currentIdx, stepData]);

  // Overall percentage
  const overallPercent = useMemo(() => {
    if (status === "completed") return 100;
    if (currentStepIdx < 0) return 0;

    const totalSteps = PIPELINE_STEPS.length;
    const basePercent = (currentStepIdx / totalSteps) * 100;
    const stepWeight = 100 / totalSteps;

    if (status === "generating" && totalShots > 0) {
      return basePercent + ((completedShots / totalShots) * stepWeight);
    }

    if (currentStepData) {
      const progress = currentStepData.avgSec > 0
        ? Math.min(0.95, currentStepData.elapsedSec / currentStepData.avgSec)
        : 0.5;
      return basePercent + progress * stepWeight;
    }

    return basePercent;
  }, [status, currentStepIdx, completedShots, totalShots, currentStepData]);

  const shotPercent = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;

  // Activity message
  const activityMessage = useMemo(() => {
    if (isFailed) {
      const failedJob = jobs.find(j => j.status === "failed");
      return failedJob?.error_message || "Le pipeline a rencontré une erreur";
    }
    switch (status) {
      case "analyzing": return "Analyse du tempo, de l'énergie et de la structure audio…";
      case "planning": return "Le réalisateur IA crée le storyboard et les bibles de style…";
      case "generating":
        if (completedShots === 0) return "Envoi des prompts aux providers vidéo…";
        return `${completedShots} plan${completedShots > 1 ? "s" : ""} généré${completedShots > 1 ? "s" : ""} sur ${totalShots}…`;
      case "stitching": return "Assemblage et synchronisation audio en cours…";
      case "completed": return "Votre vidéo est prête !";
      default: return "";
    }
  }, [status, completedShots, totalShots, isFailed, jobs]);

  return (
    <Card className="border-border/50 bg-card/60 p-5 sm:p-6 space-y-5">
      {/* Steps Row */}
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STATUS_ORDER.indexOf(step.key);
          const isDone = currentIdx > stepIdx || status === "completed";
          const isCurrent = status === step.key;
          const data = stepData[i];

          return (
            <div key={step.key} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                {/* Step Circle */}
                <motion.div
                  className={cn(
                    "flex items-center justify-center rounded-full h-8 w-8 sm:h-9 sm:w-9 transition-all duration-300 shrink-0",
                    isDone && "bg-green-500/15 text-green-500",
                    isCurrent && !isFailed && "bg-primary/15 text-primary ring-2 ring-primary/30",
                    isCurrent && isFailed && "bg-destructive/15 text-destructive ring-2 ring-destructive/30",
                    !isDone && !isCurrent && "bg-secondary text-muted-foreground/50"
                  )}
                  animate={isCurrent && !isFailed ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  {isDone ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isCurrent && !isFailed ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFailed && isCurrent ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </motion.div>

                {/* Label */}
                <span className={cn(
                  "text-[10px] sm:text-xs font-medium text-center whitespace-nowrap transition-colors",
                  isDone && "text-green-500",
                  isCurrent && !isFailed && "text-foreground font-semibold",
                  isCurrent && isFailed && "text-destructive",
                  !isDone && !isCurrent && "text-muted-foreground/60"
                )}>
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>

                {/* Real elapsed/duration under each step */}
                <AnimatePresence>
                  {(isDone && data.realDuration != null) && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-green-500/70"
                    >
                      {formatDuration(data.realDuration)}
                    </motion.span>
                  )}
                  {isCurrent && isActive && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-primary tabular-nums"
                    >
                      {formatDuration(data.elapsedSec)}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Shot counter for generating step */}
                {step.key === "generating" && (isCurrent || isDone) && totalShots > 0 && (
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    isDone ? "text-green-500" : "text-primary"
                  )}>
                    {completedShots}/{totalShots}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="relative h-px flex-1 mx-1">
                  <div className="absolute inset-0 bg-border" />
                  <motion.div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      isDone ? "bg-green-500/60" : isCurrent ? "bg-primary/40" : "bg-transparent"
                    )}
                    initial={{ width: "0%" }}
                    animate={{
                      width: isDone ? "100%" : isCurrent ? `${Math.min(95, (data.elapsedSec / data.avgSec) * 100)}%` : "0%"
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      {(isActive || status === "completed") && (
        <div className="space-y-3">
          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                status === "completed" ? "bg-green-500" : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, overallPercent)}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>

          {/* Activity + ETA row */}
          <div className="flex items-center justify-between gap-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={activityMessage}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "text-xs leading-relaxed flex items-center gap-1.5",
                  isFailed ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {isActive && <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>}
                {activityMessage}
              </motion.p>
            </AnimatePresence>

            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
              {status === "generating" && totalShots > 0 && (
                <span className="font-semibold text-primary tabular-nums">{shotPercent}%</span>
              )}
              {isActive && etaSeconds > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="h-3.5 w-3.5" />
                  {formatETA(etaSeconds)}
                </span>
              )}
              {status === "completed" && (
                <span className="text-green-500 font-medium">100%</span>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
