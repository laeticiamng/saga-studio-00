-- Add columns to source_documents
ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS document_role text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS role_confidence real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_priority text DEFAULT 'supporting_reference',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Canonical conflicts: detected contradictions between documents
CREATE TABLE public.canonical_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  entity_type text NOT NULL DEFAULT 'field',
  doc_a_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  doc_b_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  value_a jsonb,
  value_b jsonb,
  severity text NOT NULL DEFAULT 'medium',
  resolution text DEFAULT 'unresolved',
  canonical_value jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canonical_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages canonical conflicts"
  ON public.canonical_conflicts FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

CREATE TRIGGER update_canonical_conflicts_updated_at
  BEFORE UPDATE ON public.canonical_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Canonical fields: merged project truth
CREATE TABLE public.canonical_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  entity_type text NOT NULL DEFAULT 'project',
  entity_name text,
  canonical_value jsonb NOT NULL,
  source_document_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  source_passage text,
  confidence real DEFAULT 0.5,
  approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  inferred boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, field_key, entity_type, entity_name)
);

ALTER TABLE public.canonical_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages canonical fields"
  ON public.canonical_fields FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

CREATE TRIGGER update_canonical_fields_updated_at
  BEFORE UPDATE ON public.canonical_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ingestion runs: batch processing tracking
CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  documents_total integer DEFAULT 0,
  documents_processed integer DEFAULT 0,
  entities_extracted integer DEFAULT 0,
  conflicts_found integer DEFAULT 0,
  missing_detected integer DEFAULT 0,
  inferred_proposed integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages ingestion runs"
  ON public.ingestion_runs FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

CREATE TRIGGER update_ingestion_runs_updated_at
  BEFORE UPDATE ON public.ingestion_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inferred completions: AI gap-fills awaiting approval
CREATE TABLE public.inferred_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  entity_type text NOT NULL DEFAULT 'project',
  entity_name text,
  inferred_value jsonb NOT NULL,
  source_context text,
  source_document_ids uuid[] DEFAULT '{}',
  confidence real DEFAULT 0.5,
  status text NOT NULL DEFAULT 'proposed',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inferred_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages inferred completions"
  ON public.inferred_completions FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));

CREATE TRIGGER update_inferred_completions_updated_at
  BEFORE UPDATE ON public.inferred_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_canonical_conflicts_project ON public.canonical_conflicts(project_id);
CREATE INDEX idx_canonical_fields_project ON public.canonical_fields(project_id);
CREATE INDEX idx_ingestion_runs_project ON public.ingestion_runs(project_id);
CREATE INDEX idx_inferred_completions_project ON public.inferred_completions(project_id);
CREATE INDEX idx_source_documents_role ON public.source_documents(document_role);
CREATE INDEX idx_source_documents_priority ON public.source_documents(source_priority);