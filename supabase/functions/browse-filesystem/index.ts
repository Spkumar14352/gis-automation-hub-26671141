import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrowseRequest {
  path: string;
  pythonBackendUrl: string;
  type?: 'gdb' | 'sde' | 'folder' | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing authorization header');
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

    console.log(`Authenticated user: ${claimsData.claims.sub}`);

    const { path, pythonBackendUrl, type = 'all' } = await req.json() as BrowseRequest;

    if (!pythonBackendUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Python backend URL not configured',
          message: 'Please configure your Python backend URL in Settings to enable file browsing.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Browsing path: ${path || 'root'} on ${pythonBackendUrl}`);

    // Forward request to Python backend
    const backendResponse = await fetch(`${pythonBackendUrl}/browse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: path || '', type }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Python backend error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to browse filesystem',
          details: errorText
        }),
        { status: backendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await backendResponse.json();
    console.log(`Found ${data.items?.length || 0} items`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Browse error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to Python backend', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
