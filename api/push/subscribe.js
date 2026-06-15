const { jsonError, requireOwner } = require("../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { supabase, user } = await requireOwner(req);
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Neispravna push pretplata." });
    }
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: req.headers["user-agent"] || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,endpoint" }
    );
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error) {
    return jsonError(res, error);
  }
};
