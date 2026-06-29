import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  action?: "block" | "unblock";
  workspace_id?: string;
  user_id?: string;
  reason?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: "missing_supabase_env" }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ ok: false, error: "not_authenticated" }, 401);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const action = payload.action;
  const workspaceId = payload.workspace_id;
  const targetUserId = payload.user_id;

  if ((action !== "block" && action !== "unblock") || !workspaceId || !targetUserId) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }

  if (targetUserId === authData.user.id) {
    return json({ ok: false, error: "cannot_change_self" }, 400);
  }

  const { data: callerMembership, error: callerMembershipError } = await adminClient
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (callerMembershipError) {
    return json({ ok: false, error: callerMembershipError.message }, 500);
  }

  if (callerMembership?.role !== "admin") {
    return json({ ok: false, error: "admin_required" }, 403);
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetMembershipError) {
    return json({ ok: false, error: targetMembershipError.message }, 500);
  }

  if (!targetMembership) {
    return json({ ok: false, error: "target_not_in_workspace" }, 404);
  }

  if (targetMembership.role === "admin") {
    return json({ ok: false, error: "cannot_block_admin" }, 400);
  }

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    action === "block" ? { ban_duration: "876000h" } : { ban_duration: "none" },
  );

  if (authUpdateError) {
    return json({ ok: false, error: authUpdateError.message }, 500);
  }

  if (action === "block") {
    const { error: blockError } = await adminClient.from("account_blocks").upsert({
      user_id: targetUserId,
      workspace_id: workspaceId,
      blocked_by: authData.user.id,
      reason: payload.reason || null,
      blocked_at: new Date().toISOString(),
    });

    if (blockError) {
      return json({ ok: false, error: blockError.message }, 500);
    }
  } else {
    const { error: unblockError } = await adminClient
      .from("account_blocks")
      .delete()
      .eq("user_id", targetUserId);

    if (unblockError) {
      return json({ ok: false, error: unblockError.message }, 500);
    }
  }

  return json({ ok: true, action });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
