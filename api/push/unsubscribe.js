const { jsonError, requireOwner } = require("../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { supabase, user } = await requireOwner(req);
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: "Nedostaje endpoint." });
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error) {
    return jsonError(res, error);
  }
};
