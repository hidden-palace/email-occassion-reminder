import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkflowRequest {
  action: "status" | "activate" | "deactivate";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    let n8nUrl = Deno.env.get("N8N_URL");
    const n8nApiKey = Deno.env.get("N8N_API_KEY");
    const workflowId = Deno.env.get("N8N_WORKFLOW_ID");

    if (!n8nUrl || !n8nApiKey || !workflowId) {
      return new Response(
        JSON.stringify({
          error: "Missing n8n configuration. Environment variables not found.",
          details: {
            N8N_URL: !!n8nUrl,
            N8N_API_KEY: !!n8nApiKey,
            N8N_WORKFLOW_ID: !!workflowId
          }
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let body: WorkflowRequest;
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Unknown parse error"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { action } = body;

    n8nUrl = n8nUrl.replace(/\/+$/, '');

    let url: string;
    let method: string;
    let requestBody: string | undefined;

    switch (action) {
      case "status":
        url = `${n8nUrl}/api/v1/workflows/${workflowId}`;
        method = "GET";
        break;
      case "activate":
        url = `${n8nUrl}/api/v1/workflows/${workflowId}`;
        method = "PUT";
        requestBody = JSON.stringify({ active: true });
        break;
      case "deactivate":
        url = `${n8nUrl}/api/v1/workflows/${workflowId}`;
        method = "PUT";
        requestBody = JSON.stringify({ active: false });
        break;
      default:
        throw new Error("Invalid action");
    }

    const n8nResponse = await fetch(url, {
      method,
      headers: {
        "X-N8N-API-KEY": n8nApiKey,
        "Content-Type": "application/json",
      },
      ...(requestBody && { body: requestBody }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      return new Response(
        JSON.stringify({
          error: `n8n API returned ${n8nResponse.status}`,
          details: errorText.substring(0, 500),
          url: url,
          method: method
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const responseText = await n8nResponse.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      return new Response(
        JSON.stringify({
          error: "n8n API returned non-JSON response",
          details: responseText.substring(0, 500),
          url: url
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : typeof error
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});