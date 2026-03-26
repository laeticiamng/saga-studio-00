
-- Create storage bucket for source documents
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('source-documents', 'source-documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can upload to their own folder
CREATE POLICY "Users can upload source documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'source-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own source documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'source-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
