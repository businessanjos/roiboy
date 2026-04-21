import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateClientPayload {
  account_id?: string; // Optional when using API key auth (inferred from key)
  phone_e164: string;
  full_name: string;
  emails?: string[];
  cpf?: string;
  cnpj?: string;
  company_name?: string;
  tags?: string[];
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let statusCode = 500;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request (API Key or JWT)
    const auth = await authenticateRequest(req, supabase);
    if (!auth.authenticated) {
      statusCode = 401;
      // Log failed attempt if API key was provided
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const payload: CreateClientPayload = await req.json();
    console.log("Create client request:", {
      ...payload,
      phone_e164: payload.phone_e164,
      auth_method: auth.method,
    });

    // Use account from auth, or validate provided account_id matches
    const accountId = auth.accountId!;
    if (payload.account_id && payload.account_id !== accountId) {
      statusCode = 403;
      const response = new Response(
        JSON.stringify({
          error: "Forbidden: account_id does not match authenticated account",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      // Log usage for API key
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 403);
      }

      return response;
    }

    // Validate required fields
    if (!payload.phone_e164 || !payload.full_name) {
      statusCode = 400;
      const response = new Response(
        JSON.stringify({
          error: "Missing required fields: phone_e164, full_name",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 400);
      }

      return response;
    }

    // Validate phone format
    if (!payload.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
      statusCode = 400;
      const response = new Response(
        JSON.stringify({
          error: "Invalid phone format. Use E.164 format (e.g., +5511999999999)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 400);
      }

      return response;
    }

    // Check if client already exists with this phone
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("phone_e164", payload.phone_e164)
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingClient) {
      statusCode = 409;
      const response = new Response(
        JSON.stringify({
          error: "Client already exists",
          existing_client: {
            id: existingClient.id,
            full_name: existingClient.full_name,
          },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 409);
      }

      return response;
    }

    // Create the client
    const { data: newClient, error: createError } = await supabase
      .from("clients")
      .insert({
        account_id: accountId,
        phone_e164: payload.phone_e164,
        full_name: payload.full_name,
        emails: payload.emails || [],
        cpf: payload.cpf || null,
        cnpj: payload.cnpj || null,
        company_name: payload.company_name || null,
        tags: payload.tags || [],
        notes: payload.notes || null,
        status: "active",
      })
      .select("id, full_name, phone_e164, status")
      .single();

    if (createError) {
      console.error("Error creating client:", createError);
      statusCode = 500;
      const response = new Response(
        JSON.stringify({
          error: "Failed to create client",
          details: createError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 500);
      }

      return response;
    }

    console.log("Client created:", newClient.id, newClient.full_name);
    statusCode = 201;

    // Log successful API key usage
    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: newClient,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in create-client:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
