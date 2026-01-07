-- Drop existing RLS policies that require auth
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.job_history;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.job_history;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.job_history;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.job_history;

DROP POLICY IF EXISTS "Users can view their own configurations" ON public.saved_configurations;
DROP POLICY IF EXISTS "Users can insert their own configurations" ON public.saved_configurations;
DROP POLICY IF EXISTS "Users can update their own configurations" ON public.saved_configurations;
DROP POLICY IF EXISTS "Users can delete their own configurations" ON public.saved_configurations;

-- Create new policies allowing public access
CREATE POLICY "Allow public read access to job_history" 
ON public.job_history FOR SELECT USING (true);

CREATE POLICY "Allow public insert to job_history" 
ON public.job_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to job_history" 
ON public.job_history FOR UPDATE USING (true);

CREATE POLICY "Allow public delete from job_history" 
ON public.job_history FOR DELETE USING (true);

CREATE POLICY "Allow public read access to saved_configurations" 
ON public.saved_configurations FOR SELECT USING (true);

CREATE POLICY "Allow public insert to saved_configurations" 
ON public.saved_configurations FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to saved_configurations" 
ON public.saved_configurations FOR UPDATE USING (true);

CREATE POLICY "Allow public delete from saved_configurations" 
ON public.saved_configurations FOR DELETE USING (true);