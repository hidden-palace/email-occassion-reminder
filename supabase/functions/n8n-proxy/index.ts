import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey, X-N8N-API-KEY",
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

    // Parse action from JSON body if present; otherwise default to 'status'.
    const text = await req.text();
    let action: WorkflowRequest["action"] | undefined;
    if (text && text.trim().length > 0) {
      try {
        const body = JSON.parse(text) as Partial<WorkflowRequest>;
        action = body.action;
      } catch (parseError) {
        // Accept empty/invalid JSON by falling back to 'status' to be more forgiving.
      }
    }
    if (!action) {
      // Allow GET without body to act as status.
      action = req.method === "GET" ? "status" : "status";
    }

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
        url = `${n8nUrl}/api/v1/workflows/${workflowId}/activate`;
        method = "POST";
        requestBody = undefined;
        break;
      case "deactivate":
        url = `${n8nUrl}/api/v1/workflows/${workflowId}/deactivate`;
        method = "POST";
        requestBody = undefined;
        break;
      default:
        throw new Error("Invalid action");
    }

    const headers: Record<string, string> = {
      "X-N8N-API-KEY": n8nApiKey,
      "Authorization": `Bearer ${n8nApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Resolve canonical workflow id (numeric) for REST fallbacks when activating/deactivating
    let canonicalId = workflowId as string;
    if (action === "activate" || action === "deactivate") {
      try {
        const probe = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, { method: "GET", headers });
        if (probe.ok) {
          const wf = await probe.json();
          if (wf && (typeof wf.id === 'number' || typeof wf.id === 'string')) {
            canonicalId = String(wf.id);
          }
        }
      } catch (_) {
        // ignore; fallback will still try with original id
      }
    }

    // First attempt: API v1 (supports GET status, PATCH partial updates)
    let n8nResponse = await fetch(url, {
      method,
      headers,
      ...(requestBody && { body: requestBody }),
    });

    // Fallback for activate/deactivate: use REST toggle endpoints if first call failed
    if (!n8nResponse.ok && (action === "activate" || action === "deactivate")) {
      const fallbackUrl = `${n8nUrl}/rest/workflows/${canonicalId}/${action}`;
      n8nResponse = await fetch(fallbackUrl, {
        method: "POST",
        headers,
      });
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        return new Response(
          JSON.stringify({
            error: `n8n API returned ${n8nResponse.status}`,
            details: errorText.substring(0, 500),
            url: fallbackUrl,
            method: "POST",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (!n8nResponse.ok && action === "status") {
      // Fallback for status: try REST endpoint
      const fallbackUrl = `${n8nUrl}/rest/workflows/${workflowId}`;
      n8nResponse = await fetch(fallbackUrl, { method: "GET", headers });
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        return new Response(
          JSON.stringify({
            error: `n8n API returned ${n8nResponse.status}`,
            details: errorText.substring(0, 500),
            url: fallbackUrl,
            method: "GET",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      return new Response(
        JSON.stringify({
          error: `n8n API returned ${n8nResponse.status}`,
          details: errorText.substring(0, 500),
          url: url,
          method: method,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
