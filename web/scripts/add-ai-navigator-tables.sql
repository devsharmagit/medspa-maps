CREATE TABLE IF NOT EXISTS public.ai_navigator_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id text,
  ip_hash text,
  user_agent text,
  request jsonb NOT NULL,
  photo_count integer DEFAULT 0 NOT NULL,
  vision_included boolean DEFAULT false NOT NULL,
  ai_response jsonb,
  matched_clinic_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '90 days') NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_navigator_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.ai_navigator_sessions(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  step text,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_sessions_created
  ON public.ai_navigator_sessions USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_sessions_expires
  ON public.ai_navigator_sessions USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_events_session
  ON public.ai_navigator_events USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_events_name_created
  ON public.ai_navigator_events USING btree (event_name, created_at DESC);
