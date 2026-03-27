import { supabase } from "@/integrations/supabase/client";

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
const currentLevel = import.meta.env.DEV ? LOG_LEVELS.debug : LOG_LEVELS.warn;

// Debounce queue to batch-send logs and avoid spamming
let logQueue: Array<{ level: string; tag: string; message: string; details?: unknown }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 10;

async function flushLogs() {
  if (logQueue.length === 0) return;
  const batch = logQueue.splice(0, MAX_QUEUE_SIZE);

  try {
    // Fire-and-forget — don't block the UI
    for (const entry of batch) {
      supabase.functions.invoke("client-log", {
        body: entry,
      }).catch(() => {
        // Silently fail — we don't want log persistence to break the app
      });
    }
  } catch {
    // Silently fail
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, FLUSH_INTERVAL_MS);
}

function enqueue(level: string, tag: string, args: unknown[]) {
  const message = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a)))
    .join(" ");

  logQueue.push({ level, tag, message });

  if (logQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushLogs();
  } else {
    scheduleFlush();
  }
}

export const logger = {
  error: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.error) console.error(`[${tag}]`, ...args);
    enqueue("error", tag, args);
  },
  warn: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.warn) console.warn(`[${tag}]`, ...args);
    enqueue("warn", tag, args);
  },
  info: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.info) console.info(`[${tag}]`, ...args);
  },
  debug: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.debug) console.debug(`[${tag}]`, ...args);
  },
};
