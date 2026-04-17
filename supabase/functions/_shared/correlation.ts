// Distributed tracing helper.
// Extracts or generates a correlation_id propagated end-to-end across edge functions,
// agents, workflows, audit logs, diagnostics and incidents.

const HEADER_NAME = "x-correlation-id";

export function getOrCreateCorrelationId(req: Request, fallback?: string): string {
  // 1. Honor header set by caller (web client or upstream function)
  const fromHeader = req.headers.get(HEADER_NAME);
  if (fromHeader && /^[0-9a-f-]{36}$/i.test(fromHeader)) return fromHeader;
  // 2. Honor explicit body value (passed by orchestrators)
  if (fallback && /^[0-9a-f-]{36}$/i.test(fallback)) return fallback;
  // 3. Mint a new one
  return crypto.randomUUID();
}

export function correlationHeaders(correlationId: string): Record<string, string> {
  return { [HEADER_NAME]: correlationId };
}
