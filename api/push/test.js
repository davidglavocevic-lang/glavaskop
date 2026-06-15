const webpush = require("web-push");
const { getEnv, jsonError, requireOwner } = require("../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { supabase, user } = await requireOwner(req);
    webpush.setVapidDetails(
      getEnv("VAPID_SUBJECT"),
      getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY")
    );
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw error;
    await Promise.all(
      (data || []).map((item) =>
        webpush.sendNotification(
          { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
          JSON.stringify({ title: "GLAVASKOP Organizer", body: "Testna push obavijest radi.", url: "/admin/organizer/kalendar" })
        )
      )
    );
    return res.status(200).json({ sent: data?.length || 0 });
  } catch (error) {
    return jsonError(res, error);
  }
};
