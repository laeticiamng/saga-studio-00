-- Privatize the `renders` bucket
UPDATE storage.buckets SET public = false WHERE id = 'renders';

-- Add path columns to `renders` table (kept alongside existing *_url for backward compat)
ALTER TABLE public.renders
  ADD COLUMN IF NOT EXISTS master_path_16_9 text,
  ADD COLUMN IF NOT EXISTS master_path_9_16 text,
  ADD COLUMN IF NOT EXISTS teaser_path text,
  ADD COLUMN IF NOT EXISTS manifest_path text;

-- Backfill paths from existing public URLs
DO $$
BEGIN
  UPDATE public.renders
  SET master_path_16_9 = regexp_replace(master_url_16_9, '^.*/storage/v1/object/public/renders/', '')
  WHERE master_url_16_9 IS NOT NULL
    AND master_url_16_9 LIKE '%/storage/v1/object/public/renders/%'
    AND master_path_16_9 IS NULL;

  UPDATE public.renders
  SET master_path_9_16 = regexp_replace(master_url_9_16, '^.*/storage/v1/object/public/renders/', '')
  WHERE master_url_9_16 IS NOT NULL
    AND master_url_9_16 LIKE '%/storage/v1/object/public/renders/%'
    AND master_path_9_16 IS NULL;

  UPDATE public.renders
  SET teaser_path = regexp_replace(teaser_url, '^.*/storage/v1/object/public/renders/', '')
  WHERE teaser_url IS NOT NULL
    AND teaser_url LIKE '%/storage/v1/object/public/renders/%'
    AND teaser_path IS NULL;

  UPDATE public.renders
  SET manifest_path = regexp_replace(manifest_url, '^.*/storage/v1/object/public/renders/', '')
  WHERE manifest_url IS NOT NULL
    AND manifest_url LIKE '%/storage/v1/object/public/renders/%'
    AND manifest_path IS NULL;
END $$;

-- Restrict reads on private bucket
DROP POLICY IF EXISTS "Read renders by path" ON storage.objects;

CREATE POLICY "Project owners can read renders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'renders'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Service role can manage renders"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'renders')
WITH CHECK (bucket_id = 'renders');
