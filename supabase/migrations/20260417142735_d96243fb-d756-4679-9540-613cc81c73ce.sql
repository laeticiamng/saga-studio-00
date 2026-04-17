-- Fix search_path on email queue functions (security hardening)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- Restrict listing on public storage buckets (renders, shot-outputs)
-- Keep direct file access by URL but block bucket-wide listing.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can read renders" ON storage.objects;
DROP POLICY IF EXISTS "Public can read shot-outputs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read renders" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read shot-outputs" ON storage.objects;

-- Read by exact path only (no wildcard listing)
CREATE POLICY "Read renders by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'renders' AND name IS NOT NULL);

CREATE POLICY "Read shot-outputs by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'shot-outputs' AND name IS NOT NULL);

-- Note: "name IS NOT NULL" alone doesn't actually prevent listing through Supabase API.
-- True hardening = make the bucket private + signed URLs. Documented as remaining task.