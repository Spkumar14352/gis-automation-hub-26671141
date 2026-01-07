import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type JobType = 'gdb_extraction' | 'sde_conversion' | 'comparison';
export type JobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface JobHistory {
  id: string;
  user_id: string;
  job_type: JobType;
  status: JobStatus;
  config: Record<string, unknown>;
  logs: LogEntry[];
  result: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SavedConfiguration {
  id: string;
  user_id: string;
  name: string;
  job_type: JobType;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useJobHistory() {
  const { user, token } = useAuth();

  const getBackendUrl = () => {
    return localStorage.getItem('python-backend-url') || '';
  };

  const fetchJobs = async (limit = 50): Promise<JobHistory[]> => {
    const { data, error } = await supabase
      .from('job_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as JobHistory[];
  };

  const fetchJob = async (id: string): Promise<JobHistory | null> => {
    const { data, error } = await supabase
      .from('job_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as unknown as JobHistory;
  };

  const executeJob = async (
    jobType: JobType,
    config: Record<string, unknown>,
    pythonBackendUrl?: string
  ) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('execute-script', {
      body: { jobType, config, pythonBackendUrl },
    });

    if (error) throw error;
    return data;
  };

  const subscribeToJob = (jobId: string, callback: (job: JobHistory) => void) => {
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_history',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(payload.new as unknown as JobHistory);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return { fetchJobs, fetchJob, executeJob, subscribeToJob };
}

export function useSavedConfigurations() {
  const fetchConfigurations = async (jobType?: JobType): Promise<SavedConfiguration[]> => {
    let query = supabase.from('saved_configurations').select('*');
    
    if (jobType) {
      query = query.eq('job_type', jobType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as SavedConfiguration[];
  };

  const saveConfiguration = async (
    name: string,
    jobType: JobType,
    config: Record<string, unknown>,
    isDefault = false
  ): Promise<SavedConfiguration> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('saved_configurations')
      .insert({
        name,
        job_type: jobType,
        config,
        is_default: isDefault,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as SavedConfiguration;
  };

  const deleteConfiguration = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('saved_configurations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  };

  return { fetchConfigurations, saveConfiguration, deleteConfiguration };
}
