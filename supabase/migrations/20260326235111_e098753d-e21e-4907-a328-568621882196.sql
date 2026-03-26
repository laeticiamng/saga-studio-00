
-- ================================================
-- BLOC A: Document Ingestion Pipeline Tables
-- ================================================

-- 1. Source documents
CREATE TABLE public.source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'unknown',
  file_size_bytes bigint DEFAULT 0,
  storage_path text,
  extraction_mode text DEFAULT 'native',
  status text NOT NULL DEFAULT 'uploaded',
  version integer NOT NULL DEFAULT 1,
  parent_document_id uuid REFERENCES public.source_documents(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Document chunks (segments of text)
CREATE TABLE public.source_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL DEFAULT '',
  section_type text DEFAULT 'body',
  page_number integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Extracted entities
CREATE TABLE public.source_document_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_key text NOT NULL,
  entity_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_chunk_id uuid REFERENCES public.source_document_chunks(id),
  source_passage text,
  extraction_confidence real NOT NULL DEFAULT 0.5,
  mapping_confidence real DEFAULT 0.5,
  semantic_confidence real DEFAULT 0.5,
  ambiguity_flag boolean DEFAULT false,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Field mappings (entity → platform field)
CREATE TABLE public.source_document_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.source_document_entities(id) ON DELETE CASCADE,
  target_table text NOT NULL,
  target_field text NOT NULL,
  target_record_id uuid,
  proposed_value jsonb,
  current_value jsonb,
  status text NOT NULL DEFAULT 'proposed',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Autofill runs
CREATE TABLE public.source_document_autofill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_fields integer DEFAULT 0,
  auto_filled integer DEFAULT 0,
  needs_review integer DEFAULT 0,
  rejected integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Field provenance
CREATE TABLE public.field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table text NOT NULL,
  target_field text NOT NULL,
  target_record_id uuid NOT NULL,
  source_document_id uuid REFERENCES public.source_documents(id),
  source_passage text,
  extraction_confidence real DEFAULT 0.5,
  extraction_date timestamptz DEFAULT now(),
  document_version integer DEFAULT 1,
  status text NOT NULL DEFAULT 'auto_filled',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_source_documents_project ON public.source_documents(project_id);
CREATE INDEX idx_source_documents_series ON public.source_documents(series_id);
CREATE INDEX idx_source_document_chunks_doc ON public.source_document_chunks(document_id);
CREATE INDEX idx_source_document_entities_doc ON public.source_document_entities(document_id);
CREATE INDEX idx_source_document_entities_type ON public.source_document_entities(entity_type);
CREATE INDEX idx_source_document_mappings_entity ON public.source_document_mappings(entity_id);
CREATE INDEX idx_field_provenance_target ON public.field_provenance(target_table, target_record_id);

-- RLS
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_document_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_document_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_document_autofill_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_provenance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for source_documents
CREATE POLICY "Users can view own source_documents" ON public.source_documents
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own source_documents" ON public.source_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update own source_documents" ON public.source_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

-- RLS for chunks
CREATE POLICY "Users can view own chunks" ON public.source_document_chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd WHERE sd.id = source_document_chunks.document_id AND (sd.uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- RLS for entities
CREATE POLICY "Users can view own entities" ON public.source_document_entities
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd WHERE sd.id = source_document_entities.document_id AND (sd.uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- RLS for mappings
CREATE POLICY "Users can view own mappings" ON public.source_document_mappings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_document_entities sde
    JOIN public.source_documents sd ON sd.id = sde.document_id
    WHERE sde.id = source_document_mappings.entity_id AND (sd.uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can update own mappings" ON public.source_document_mappings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_document_entities sde
    JOIN public.source_documents sd ON sd.id = sde.document_id
    WHERE sde.id = source_document_mappings.entity_id AND sd.uploaded_by = auth.uid()
  ));

-- RLS for autofill runs
CREATE POLICY "Users can view own autofill_runs" ON public.source_document_autofill_runs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd WHERE sd.id = source_document_autofill_runs.document_id AND (sd.uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- RLS for field provenance
CREATE POLICY "Users can view own provenance" ON public.field_provenance
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd WHERE sd.id = field_provenance.source_document_id AND (sd.uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- Add document ingestion agents to registry
INSERT INTO public.agent_registry (slug, name, category, role, description, status, is_active, dependencies)
VALUES 
  ('document_ingestion', 'Agent d''ingestion documentaire', 'ingestion', 'Comprendre et structurer un document importé', 'Extrait le texte, segmente et identifie les entités à partir de documents source (PDF, DOCX, TXT, Markdown)', 'active', true, '{}'),
  ('autofill_mapper', 'Agent de pré-remplissage', 'ingestion', 'Mapper les entités extraites vers les champs de la plateforme', 'Propose des mappings automatiques entre les entités extraites et les champs de création (série, épisode, bible, personnages)', 'active', true, '{document_ingestion}')
ON CONFLICT (slug) DO NOTHING;
