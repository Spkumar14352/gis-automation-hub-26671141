-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create job status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'success', 'failed');

-- Create job type enum
CREATE TYPE public.job_type AS ENUM ('gdb_extraction', 'sde_conversion', 'comparison');

-- Create job_history table
CREATE TABLE public.job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL DEFAULT '{}',
  logs JSONB NOT NULL DEFAULT '[]',
  result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on job_history
ALTER TABLE public.job_history ENABLE ROW LEVEL SECURITY;

-- Job history policies
CREATE POLICY "Users can view their own jobs"
  ON public.job_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON public.job_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.job_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON public.job_history FOR DELETE
  USING (auth.uid() = user_id);

-- Create saved_configurations table
CREATE TABLE public.saved_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_type job_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on saved_configurations
ALTER TABLE public.saved_configurations ENABLE ROW LEVEL SECURITY;

-- Saved configurations policies
CREATE POLICY "Users can view their own configurations"
  ON public.saved_configurations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own configurations"
  ON public.saved_configurations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configurations"
  ON public.saved_configurations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configurations"
  ON public.saved_configurations FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_job_history_user_id ON public.job_history(user_id);
CREATE INDEX idx_job_history_status ON public.job_history(status);
CREATE INDEX idx_job_history_created_at ON public.job_history(created_at DESC);
CREATE INDEX idx_saved_configurations_user_id ON public.saved_configurations(user_id);

-- Enable realtime for job_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_history;