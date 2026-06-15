(async function () {
  "use strict";

  const form = document.getElementById("admin-login-form");
  const errorNode = document.getElementById("login-error");
  const button = form?.querySelector("button[type=submit]");

  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "Konfiguracija nije dostupna.");
    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await client.auth.getSession();
    if (data.session) {
      location.replace("/admin/organizer");
      return;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorNode.textContent = "";
      button.disabled = true;
      button.textContent = "Prijava…";
      const values = new FormData(form);
      const { error } = await client.auth.signInWithPassword({
        email: String(values.get("email")).trim(),
        password: String(values.get("password"))
      });
      if (error) {
        errorNode.textContent = "Prijava nije uspjela. Provjerite e-mail i lozinku.";
        button.disabled = false;
        button.innerHTML = "Prijavi se <span>↗</span>";
        return;
      }
      location.replace("/admin/organizer");
    });
  } catch (error) {
    errorNode.textContent = error.message;
    if (button) button.disabled = true;
  }
})();
