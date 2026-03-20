const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
const currentLevel = import.meta.env.DEV ? LOG_LEVELS.debug : LOG_LEVELS.warn;

export const logger = {
  error: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.error) console.error(`[${tag}]`, ...args);
  },
  warn: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.warn) console.warn(`[${tag}]`, ...args);
  },
  info: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.info) console.info(`[${tag}]`, ...args);
  },
  debug: (tag: string, ...args: unknown[]) => {
    if (currentLevel >= LOG_LEVELS.debug) console.debug(`[${tag}]`, ...args);
  },
};
