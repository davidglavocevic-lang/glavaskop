module.exports = function handler(_req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: "Supabase javne varijable nisu postavljene." });
  }
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
  });
};
