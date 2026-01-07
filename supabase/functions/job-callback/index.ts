import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobCallbackRequest {
  jobId: string;
  status: 'running' | 'success' | 'failed';
  logs?: Array<{ timestamp: string; type: string; message: string }>;
  result?: Record<string, unknown>;
}

interface JobRecord {
  logs: Array<{ timestamp: string; type: string; message: string }>;
  started_at?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { jobId, status, logs, result } = await req.json() as JobCallbackRequest;

    if (!jobId || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jobId and status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating job ${jobId} to status: ${status}`);

    // Get current job to append logs
    const { data: currentJob, error: fetchError } = await supabase
      .from('job_history')
      .select('logs, started_at')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch job:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobRecord = currentJob as JobRecord;
    const updatedLogs = logs 
      ? [...(jobRecord.logs || []), ...logs]
      : jobRecord.logs;

    const updateData: Record<string, unknown> = {
      status,
      logs: updatedLogs,
    };

    if (status === 'running' && !jobRecord.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    if (status === 'success' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (result) {
      updateData.result = result;
    }

    const { error: updateError } = await supabase
      .from('job_history')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Job ${jobId} updated successfully`);

    return new Response(
      JSON.stringify({ success: true, jobId, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
