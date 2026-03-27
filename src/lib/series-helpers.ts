/**
 * Safely extract the project title from a series object returned by useSeries().
 * The series query joins `project:projects!series_project_id_fkey(...)`,
 * so `series.project` is typed as an object with `title`.
 */
export function getSeriesProjectTitle(
  series: { project?: unknown } | null | undefined
): string {
  if (!series?.project) return "Série";
  const project = series.project as Record<string, unknown> | null;
  return String(project?.title || "Série");
}
