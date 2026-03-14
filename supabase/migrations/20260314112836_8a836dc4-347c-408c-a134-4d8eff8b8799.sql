
-- Add render_mode and manifest_url to renders table
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS render_mode text DEFAULT 'none';
ALTER TABLE public.renders ADD COLUMN IF NOT EXISTS manifest_url text;

-- Update the validate_render_completion trigger function
-- Allow manifest.json URLs ONLY when render_mode = 'client_assembly'
CREATE OR REPLACE FUNCTION public.validate_render_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' THEN
    -- For server renders: require real master_url_16_9
    IF NEW.render_mode = 'server' THEN
      IF NEW.master_url_16_9 IS NULL OR NEW.master_url_16_9 = '' THEN
        RAISE EXCEPTION 'Server render completed without master_url_16_9';
      END IF;
      IF NEW.master_url_16_9 LIKE '%placeholder%' OR NEW.master_url_16_9 LIKE 'data:%' THEN
        RAISE EXCEPTION 'Server render completed with placeholder URL';
      END IF;
    END IF;
    
    -- For client_assembly: require manifest_url
    IF NEW.render_mode = 'client_assembly' THEN
      IF NEW.manifest_url IS NULL OR NEW.manifest_url = '' THEN
        RAISE EXCEPTION 'Client assembly render completed without manifest_url';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add provider_type column to shots to distinguish image vs video providers
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS provider_type text DEFAULT 'video';

COMMENT ON COLUMN public.renders.render_mode IS 'server = real MP4 from FFmpeg service, client_assembly = manifest for browser FFmpeg, none = not yet rendered';
COMMENT ON COLUMN public.renders.manifest_url IS 'URL to manifest.json for client-side assembly (separate from master video URLs)';
COMMENT ON COLUMN public.shots.provider_type IS 'video = real video provider (runway/luma), image = image-to-video via stills (openai/dall-e)';
