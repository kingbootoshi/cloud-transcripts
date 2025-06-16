-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table
CREATE TABLE public.videos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES auth.users(id),
  source_type  text CHECK (source_type IN ('upload','youtube')),
  source_url   text,
  duration_sec int,
  size_bytes   bigint,
  status       text CHECK (status IN ('queued','processing','done','error')) DEFAULT 'queued',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Create transcripts table
CREATE TABLE public.transcripts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  markdown_key   text,
  json_key       text,
  words_jsonb    jsonb,
  speaker_labels jsonb,
  created_at     timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_videos_owner_id ON public.videos(owner_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_transcripts_video_id ON public.transcripts(video_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos
-- Allow anonymous users to create videos
CREATE POLICY "anon_create_videos" ON public.videos
  FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own videos or anonymous videos
CREATE POLICY "view_own_or_anon_videos" ON public.videos
  FOR SELECT
  USING (
    owner_id IS NULL OR 
    owner_id = auth.uid()
  );

-- Allow users to update their own videos
CREATE POLICY "update_own_videos" ON public.videos
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- RLS Policies for transcripts
-- Allow viewing transcripts for videos you can see
CREATE POLICY "view_allowed_transcripts" ON public.transcripts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = transcripts.video_id
      AND (videos.owner_id IS NULL OR videos.owner_id = auth.uid())
    )
  );

-- Allow updating transcripts for videos you own
CREATE POLICY "update_own_transcripts" ON public.transcripts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = transcripts.video_id
      AND videos.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = transcripts.video_id
      AND videos.owner_id = auth.uid()
    )
  );

-- Service role can do anything (for webhook)
CREATE POLICY "service_role_all_videos" ON public.videos
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_transcripts" ON public.transcripts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create a view for real-time updates
CREATE OR REPLACE VIEW public.v_videos AS
  SELECT 
    id,
    owner_id,
    source_type,
    source_url,
    duration_sec,
    size_bytes,
    status,
    created_at,
    updated_at
  FROM public.videos;

-- Grant permissions
GRANT ALL ON public.videos TO anon, authenticated, service_role;
GRANT ALL ON public.transcripts TO anon, authenticated, service_role;
GRANT SELECT ON public.v_videos TO anon, authenticated;