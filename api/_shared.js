const { createClient } = require("@supabase/supabase-js");

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function adminClient() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireOwner(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw Object.assign(new Error("Nedostaje pristupni token."), { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw Object.assign(new Error("Nevažeća prijava."), { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profileError || !["admin", "owner"].includes(profile?.role)) {
    throw Object.assign(new Error("Pristup je dopušten samo vlasniku."), { status: 403 });
  }
  return { supabase, user: data.user };
}

function jsonError(res, error) {
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? "Greška na poslužitelju." : error.message });
}

module.exports = { adminClient, getEnv, jsonError, requireOwner };
