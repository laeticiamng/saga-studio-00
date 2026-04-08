
-- Add parser_version and latest_successful_run columns
ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS parser_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS latest_successful_run JSONB DEFAULT NULL;

-- Backfill parser_version from metadata or mark as legacy
UPDATE public.source_documents
SET parser_version = CASE
  WHEN metadata->'extraction_debug'->>'parser_version' IS NOT NULL
    THEN metadata->'extraction_debug'->>'parser_version'
  WHEN status = 'analyzed' THEN 'legacy'
  ELSE NULL
END
WHERE parser_version IS NULL;

-- Create index for fast legacy detection
CREATE INDEX IF NOT EXISTS idx_source_documents_parser_version
  ON public.source_documents (parser_version);
