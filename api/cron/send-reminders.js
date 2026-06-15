const webpush = require("web-push");
const { adminClient, getEnv, jsonError } = require("../_shared");

module.exports = async function handler(req, res) {
  try {
    const expected = getEnv("CRON_SECRET");
    if (req.headers.authorization !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    webpush.setVapidDetails(
      getEnv("VAPID_SUBJECT"),
      getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      getEnv("VAPID_PRIVATE_KEY")
    );
    const supabase = adminClient();
    const now = new Date();
    const lateWindow = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: reminders, error } = await supabase
      .from("calendar_reminders")
      .select("id,event_id,calendar_events(title,start_time,location)")
      .eq("status", "pending")
      .is("sent_at", null)
      .gte("remind_at", lateWindow)
      .lte("remind_at", now.toISOString())
      .limit(100);
    if (error) throw error;

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*");
    if (subError) throw subError;

    let sent = 0;
    for (const reminder of reminders || []) {
      const event = reminder.calendar_events;
      const payload = JSON.stringify({
        title: event?.title || "Nadolazeći termin",
        body: `${event?.location ? `${event.location} · ` : ""}${new Date(event?.start_time).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" })}`,
        url: "/admin/organizer/kalendar"
      });
      const results = await Promise.allSettled(
        (subscriptions || []).map((item) =>
          webpush.sendNotification(
            { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
            payload
          )
        )
      );
      const delivered = results.some((result) => result.status === "fulfilled");
      if (delivered || !(subscriptions || []).length) {
        await supabase
          .from("calendar_reminders")
          .update({ status: "sent", sent_at: now.toISOString() })
          .eq("id", reminder.id);
        sent += 1;
      }
    }
    return res.status(200).json({ checked: reminders?.length || 0, sent });
  } catch (error) {
    return jsonError(res, error);
  }
};
