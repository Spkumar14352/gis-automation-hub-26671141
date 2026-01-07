import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteScriptRequest {
  jobType: 'gdb_extraction' | 'sde_conversion' | 'comparison';
  config: Record<string, unknown>;
  pythonBackendUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    // Parse request body
    const { jobType, config, pythonBackendUrl } = await req.json() as ExecuteScriptRequest;

    if (!jobType || !config) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jobType and config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating job for type: ${jobType}`);

    // Create job record in database
    const { data: job, error: insertError } = await supabase
      .from('job_history')
      .insert({
        user_id: userId,
        job_type: jobType,
        status: 'pending',
        config: config,
        logs: [{ timestamp: new Date().toISOString(), type: 'info', message: 'Job created' }],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create job:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create job', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Job created with ID: ${job.id}`);

    // If a Python backend URL is provided, attempt to forward the request
    if (pythonBackendUrl) {
      console.log(`Forwarding request to Python backend: ${pythonBackendUrl}`);
      
      // Update job status to running
      await supabase
        .from('job_history')
        .update({ 
          status: 'running', 
          started_at: new Date().toISOString(),
          logs: [
            ...job.logs,
            { timestamp: new Date().toISOString(), type: 'info', message: 'Connecting to Python backend...' }
          ]
        })
        .eq('id', job.id);

      try {
        const backendResponse = await fetch(`${pythonBackendUrl}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: job.id,
            jobType,
            config,
            callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/job-callback`,
          }),
        });

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text();
          console.error(`Python backend error: ${errorText}`);
          
          await supabase
            .from('job_history')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
              logs: [
                ...job.logs,
                { timestamp: new Date().toISOString(), type: 'error', message: `Python backend error: ${errorText}` }
              ]
            })
            .eq('id', job.id);

          return new Response(
            JSON.stringify({ 
              jobId: job.id, 
              status: 'failed', 
              error: 'Python backend request failed' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const backendData = await backendResponse.json();
        console.log('Python backend accepted job:', backendData);

        return new Response(
          JSON.stringify({ 
            jobId: job.id, 
            status: 'running',
            message: 'Job submitted to Python backend'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (backendError) {
        const errorMessage = backendError instanceof Error ? backendError.message : 'Unknown error';
        console.error('Failed to connect to Python backend:', errorMessage);
        
        await supabase
          .from('job_history')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
            logs: [
              ...job.logs,
              { timestamp: new Date().toISOString(), type: 'error', message: `Failed to connect to Python backend: ${errorMessage}` }
            ]
          })
          .eq('id', job.id);

        return new Response(
          JSON.stringify({ 
            jobId: job.id, 
            status: 'failed', 
            error: 'Could not connect to Python backend' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No Python backend - return job in pending state for demo/simulation
    console.log('No Python backend URL provided, job created in pending state');
    
    return new Response(
      JSON.stringify({ 
        jobId: job.id, 
        status: 'pending',
        message: 'Job created. Configure PYTHON_BACKEND_URL to connect to your ArcPy server.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
