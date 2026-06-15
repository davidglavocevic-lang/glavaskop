(async function () {
  "use strict";

  const app = document.getElementById("organizer-app");
  const modal = document.getElementById("organizer-modal");
  const modalForm = document.getElementById("organizer-form");
  const modalFields = document.getElementById("modal-fields");
  const modalTitle = document.getElementById("modal-title");
  const modalError = document.getElementById("modal-error");
  const currency = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });
  const number = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 });
  const dateFormatter = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" });
  const dateTimeFormatter = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });

  let client;
  let session;
  let config;
  let modalSubmit = null;
  let modalDelete = null;
  let calendarCursor = new Date();
  let calendarView = "month";
  const state = {
    websiteSettings: {},
    websiteProjects: [],
    employees: [],
    projects: [],
    workers: [],
    payments: [],
    expenses: [],
    files: [],
    events: [],
    holidays: []
  };

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const isoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const localInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const statusLabel = {
    planned: "Planirano",
    active: "Aktivno",
    finished: "Završeno",
    paid: "Plaćeno",
    cancelled: "Otkazano",
    done: "Gotovo"
  };
  const eventTypeLabel = {
    work: "Posao",
    meeting: "Sastanak",
    reminder: "Podsjetnik",
    deadline: "Rok",
    private: "Privatno",
    equipment: "Servis / oprema",
    holiday: "Praznik"
  };

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `org-toast ${type}`;
    node.textContent = message;
    document.getElementById("toast-stack").append(node);
    setTimeout(() => node.remove(), 5000);
  }

  function fail(error, fallback = "Došlo je do pogreške.") {
    console.error(error);
    toast(error?.message || fallback, "error");
  }

  function pageHead(eyebrow, title, description, action = "") {
    return `<div class="org-page-head">
      <div><p class="eyebrow dark">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>
      <div class="org-actions">${action}</div>
    </div>`;
  }

  function empty(message) {
    return `<div class="empty-state">${esc(message)}</div>`;
  }

  function statusBadge(value) {
    return `<span class="status-badge status-${esc(value)}">${esc(statusLabel[value] || value)}</span>`;
  }

  function getEmployee(id) {
    return state.employees.find((item) => item.id === id);
  }

  function getProject(id) {
    return state.projects.find((item) => item.id === id);
  }

  function mediaUrl(value) {
    if (!value) return "/images/hero.jpeg";
    return /^https?:\/\//i.test(value) ? value : `/${String(value).replace(/^\/+/, "")}`;
  }

  function monthBounds(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
  }

  function earnedForEmployee(employee, currentMonthOnly = false) {
    const { start, end } = monthBounds(new Date());
    return state.workers
      .filter((item) => item.employee_id === employee.id)
      .filter((item) => {
        if (!currentMonthOnly) return true;
        const project = getProject(item.project_id);
        const date = new Date(project?.start_date || project?.created_at || 0);
        return date >= start && date < end;
      })
      .reduce((total, item) => total + Number(item.agreed_amount || Number(item.hours_worked || 0) * Number(employee.hourly_rate || 0)), 0);
  }

  function paidForEmployee(employee, currentMonthOnly = false) {
    const { start, end } = monthBounds(new Date());
    return state.payments
      .filter((item) => item.employee_id === employee.id)
      .filter((item) => {
        if (!currentMonthOnly) return true;
        const date = new Date(`${item.paid_at}T12:00:00`);
        return date >= start && date < end;
      })
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }

  async function loadAll() {
    const queries = [
      ["websiteSettings", client.from("website_settings").select("data").eq("id", "company").single()],
      ["websiteProjects", client.from("website_projects").select("*").order("sort_order").order("created_at")],
      ["employees", client.from("employees").select("*").order("active", { ascending: false }).order("name")],
      ["projects", client.from("internal_projects").select("*").order("created_at", { ascending: false })],
      ["workers", client.from("project_workers").select("*").order("created_at", { ascending: false })],
      ["payments", client.from("employee_payments").select("*").order("paid_at", { ascending: false })],
      ["expenses", client.from("expenses").select("*").order("expense_date", { ascending: false })],
      ["files", client.from("project_files").select("*").order("created_at", { ascending: false })],
      ["events", client.from("calendar_events").select("*").order("start_time")],
      ["holidays", client.from("holidays").select("*").order("date")]
    ];
    const results = await Promise.all(queries.map(([, query]) => query));
    results.forEach((result, index) => {
      if (result.error) throw result.error;
      const key = queries[index][0];
      state[key] = key === "websiteSettings" ? (result.data?.data || {}) : (result.data || []);
    });
  }

  function setActiveRoute() {
    document.querySelectorAll("[data-route]").forEach((link) => {
      const route = link.dataset.route;
      const active = ["/admin/web", "/admin/organizer"].includes(route)
        ? location.pathname === route
        : location.pathname.startsWith(route);
      link.classList.toggle("active", active);
    });
  }

  function setAdminSection(title) {
    document.getElementById("admin-section-title").textContent = title;
  }

  function navigate(path) {
    history.pushState({}, "", path);
    renderRoute();
    document.getElementById("organizer-sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeRecord(table, id, label, beforeDelete) {
    if (!confirm(`Obrisati ${label}? Ovu radnju nije moguće poništiti.`)) return;
    try {
      if (beforeDelete) await beforeDelete();
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) throw error;
      await loadAll();
      toast("Zapis je obrisan.");
      renderRoute();
    } catch (error) {
      fail(error, "Brisanje nije uspjelo.");
    }
  }

  function openModal({ title, eyebrow = "ORGANIZER", fields, submit, deleteAction, afterOpen }) {
    modalTitle.textContent = title;
    document.getElementById("modal-eyebrow").textContent = eyebrow;
    modalFields.innerHTML = `<div class="form-grid">${fields}</div>`;
    modalError.textContent = "";
    modalSubmit = submit;
    modalDelete = deleteAction || null;
    document.getElementById("modal-delete").hidden = !modalDelete;
    modal.showModal();
    afterOpen?.();
    modalFields.querySelector("input,select,textarea")?.focus();
  }

  function closeModal() {
    modal.close();
    modalSubmit = null;
    modalDelete = null;
    modalForm.reset();
  }

  function leaveFormRoute() {
    const path = location.pathname.replace(/\/+$/, "");
    if (path.endsWith("/mitarbeiter/new") || /\/mitarbeiter\/[0-9a-f-]+\/edit$/i.test(path)) {
      history.replaceState({}, "", "/admin/organizer/mitarbeiter");
    } else if (path.endsWith("/projekte/new")) {
      history.replaceState({}, "", "/admin/organizer/projekte");
    } else {
      const match = path.match(/^(\/admin\/organizer\/projekte\/[0-9a-f-]+)\/edit$/i);
      if (match) history.replaceState({}, "", match[1]);
    }
  }

  function formValue(formData, name) {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : value;
  }

  function field(label, name, value = "", options = {}) {
    const className = options.full ? "full" : "";
    const attrs = `${options.required ? "required" : ""} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.step ? `step="${options.step}"` : ""}`;
    if (options.type === "textarea") {
      return `<label class="${className}"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="${options.rows || 4}" ${attrs}>${esc(value)}</textarea></label>`;
    }
    if (options.type === "select") {
      return `<label class="${className}"><span>${esc(label)}</span><select name="${esc(name)}" ${attrs}>${options.choices
        .map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${esc(optionLabel)}</option>`)
        .join("")}</select></label>`;
    }
    return `<label class="${className}"><span>${esc(label)}</span><input name="${esc(name)}" type="${options.type || "text"}" value="${esc(value)}" ${attrs}></label>`;
  }

  function renderDashboard() {
    const now = new Date();
    const today = isoDate(now);
    const { start, end } = monthBounds(now);
    const activeProjects = state.projects.filter((item) => item.status === "active");
    const todayEvents = state.events.filter((item) => isoDate(new Date(item.start_time)) === today && item.status !== "cancelled");
    const nextEvent = state.events.find((item) => new Date(item.start_time) > now && item.status === "planned");
    const monthPayments = state.payments.filter((item) => {
      const date = new Date(`${item.paid_at}T12:00:00`);
      return date >= start && date < end;
    });
    const earned = state.employees.reduce((sum, employee) => sum + earnedForEmployee(employee, true), 0);
    const paid = monthPayments.reduce((sum, item) => sum + Number(item.amount), 0);

    app.innerHTML = pageHead("POSLOVNI PREGLED", "Organizer", "Privatna evidencija projekata, radnika, termina, dokumenata i financija.") +
      `<div class="org-grid">
        ${stat(activeProjects.length, "Aktivni interni projekti", true)}
        ${stat(todayEvents.length, "Današnji termini")}
        ${stat(nextEvent ? dateTimeFormatter.format(new Date(nextEvent.start_time)) : "Nema", "Sljedeći podsjetnik")}
        ${stat(currency.format(activeProjects.reduce((sum, item) => sum + Number(item.price), 0)), "Vrijednost aktivnih projekata")}
        ${stat(state.employees.filter((item) => item.active).length, "Aktivni radnici")}
        ${stat(currency.format(earned), "Zarađeno ovaj mjesec")}
        ${stat(currency.format(paid), "Isplaćeno ovaj mjesec")}
        ${stat(currency.format(Math.max(earned - paid, 0)), "Još za isplatiti", true)}
      </div>
      <div class="org-panels">
        ${listPanel("Zadnji projekti", state.projects.slice(0, 5).map((item) => [item.title, `${item.location || "Bez lokacije"} · ${statusLabel[item.status]}`, currency.format(item.price)]), "Nema internih projekata.")}
        ${listPanel("Sljedeći termini", state.events.filter((item) => new Date(item.start_time) >= now && item.status === "planned").slice(0, 5).map((item) => [item.title, dateTimeFormatter.format(new Date(item.start_time)), item.location || eventTypeLabel[item.type]]), "Nema nadolazećih termina.")}
        ${listPanel("Zadnje isplate", state.payments.slice(0, 5).map((item) => [getEmployee(item.employee_id)?.name || "Radnik", dateFormatter.format(new Date(`${item.paid_at}T12:00:00`)), currency.format(item.amount)]), "Nema isplata.")}
        ${listPanel("Zadnji dokumenti", state.files.slice(0, 5).map((item) => [item.original_file_name || item.file_name, getProject(item.project_id)?.title || "Projekt", formatBytes(item.compressed_size_bytes || item.file_size_bytes)]), "Nema dokumenata.")}
      </div>`;
  }

  function renderWebsiteDashboard() {
    const company = window.COMPANY_DATA || {};
    const reviews = window.REVIEWS_DATA || [];
    app.innerHTML = pageHead(
      "UPRAVLJANJE JAVNOM STRANICOM",
      "Web stranica",
      "Projekti za portfolio, recenzije i centralni podaci firme odvojeni su od privatnog Organizera.",
      '<a class="button button-dark" href="/" target="_blank" rel="noopener">Pregledaj javnu stranicu ↗</a>'
    ) +
      `<div class="org-grid">
        ${stat(state.websiteProjects.length, "Projekti na webu", true)}
        ${stat(state.websiteProjects.filter((item) => item.featured).length, "Istaknuti projekti")}
        ${stat(reviews.length, "Demo recenzije")}
        ${stat(company.services?.length || 0, "Objavljene usluge")}
      </div>
      <div class="org-panels">
        ${listPanel(
          "Projekti za web",
          state.websiteProjects.slice(0, 5).map((item) => [
            item.title,
            `${item.location || "Bez lokacije"} · ${item.category}`,
            item.featured ? "Istaknuto" : item.status
          ]),
          "Nema web projekata."
        )}
        <section class="org-card">
          <div class="org-card-head"><h2>Brze akcije</h2></div>
          <div class="org-list">
            <a class="org-list-item" data-route="/admin/web/projekti" href="/admin/web/projekti"><span><strong>Upravljaj projektima</strong><small>Dodavanje, uređivanje i brisanje javnog portfolija</small></span><strong>→</strong></a>
            <a class="org-list-item" data-route="/admin/web/recenzije" href="/admin/web/recenzije"><span><strong>Pregledaj recenzije</strong><small>Trenutni demo zapisi prikazani na naslovnici</small></span><strong>→</strong></a>
            <a class="org-list-item" data-route="/admin/web/sadrzaj" href="/admin/web/sadrzaj"><span><strong>Podaci firme</strong><small>Kontakt, adresa, usluge i radno vrijeme</small></span><strong>→</strong></a>
          </div>
        </section>
      </div>`;
  }

  function renderWebsiteProjects() {
    app.innerHTML = pageHead(
      "JAVNI PORTFOLIO",
      "Projekti za web",
      "Ovi projekti prikazuju se na javnoj stranici. Privatni Organizer projekti ostaju potpuno odvojeni.",
      '<button class="button button-dark" data-action="new-website-project">+ Novi web projekt</button>'
    ) +
      `<div class="org-toolbar"><input type="search" id="website-project-search" placeholder="Pretraži web projekte…"><select id="website-project-category"><option value="">Sve kategorije</option>${[...new Set(state.websiteProjects.map((item) => item.category))].map((value) => `<option>${esc(value)}</option>`).join("")}</select></div>
      <div class="org-table-wrap"><table class="org-table"><thead><tr><th>Projekt</th><th>Kategorija</th><th>Lokacija</th><th>Status</th><th>Istaknuto</th><th>Redoslijed</th><th>Akcije</th></tr></thead><tbody id="website-project-rows"></tbody></table></div>`;
    drawWebsiteProjectRows();
  }

  function drawWebsiteProjectRows() {
    const target = document.getElementById("website-project-rows");
    if (!target) return;
    const query = document.getElementById("website-project-search")?.value.toLowerCase().trim() || "";
    const category = document.getElementById("website-project-category")?.value || "";
    const rows = state.websiteProjects.filter((project) =>
      [project.title, project.location, project.category].some((value) => String(value || "").toLowerCase().includes(query)) &&
      (!category || project.category === category)
    );
    target.innerHTML = rows.length ? rows.map((project) => `<tr>
      <td><div class="table-project"><img src="${esc(mediaUrl(project.image))}" alt=""><strong>${esc(project.title)}</strong></div></td>
      <td>${esc(project.category)}</td><td>${esc(project.location || "—")}</td><td><span class="status-badge status-active">${esc(project.status)}</span></td>
      <td>${project.featured ? "Da" : "Ne"}</td><td>${project.sort_order}</td>
      <td><div class="org-table-actions"><a class="org-icon-button" href="/project-detail.html?project=${encodeURIComponent(project.slug)}" target="_blank" rel="noopener">Pregled</a><button class="org-icon-button" data-edit-website-project="${project.id}">Uredi</button><button class="org-icon-button danger" data-delete-website-project="${project.id}">Briši</button></div></td>
    </tr>`).join("") : `<tr><td colspan="7">${empty("Nema web projekata za odabrani filter.")}</td></tr>`;
  }

  function websiteProjectModal(project) {
    const existingImages = [...new Set([project?.image, ...(project?.gallery || [])].filter(Boolean))];
    const existingMedia = existingImages.length
      ? `<div class="website-media-existing full">
          <span class="website-field-label">Postojeće fotografije</span>
          <p>Označi koja treba biti naslovna. Fotografije označene za uklanjanje nestat će iz projekta nakon spremanja.</p>
          <div class="website-media-grid">${existingImages.map((url, index) => `
            <article class="website-media-item">
              <img src="${esc(mediaUrl(url))}" alt="Fotografija projekta ${index + 1}">
              <label class="media-choice"><input type="radio" name="existing_cover_choice" value="${esc(url)}" ${url === project?.image ? "checked" : ""}> Naslovna</label>
              <label class="media-remove"><input type="checkbox" name="remove_media" value="${esc(url)}"> Ukloni</label>
            </article>`).join("")}</div>
        </div>`
      : "";
    openModal({
      title: project ? "Uredi web projekt" : "Novi web projekt",
      eyebrow: "JAVNA WEB STRANICA",
      fields:
        '<h3 class="form-section-title">Osnovni podaci</h3>' +
        field("Naslov", "title", project?.title, { required: true, full: true }) +
        field("Slug / URL", "slug", project?.slug, { full: true }) +
        field("Kategorija", "category", project?.category || "Iskopi", { type: "select", choices: ["Iskopi", "Rušenja", "Uređenje terena", "Odvoz"].map((value) => [value, value]) }) +
        field("Lokacija", "location", project?.location, { required: true }) +
        field("Status", "status", project?.status || "Dovršeno") +
        field("Godina / datum", "project_date", project?.project_date || String(new Date().getFullYear()) + ".") +
        field("Istaknuti projekt", "featured", String(project?.featured ?? false), { type: "select", choices: [["false", "Ne"], ["true", "Da"]] }) +
        field("Redoslijed", "sort_order", project?.sort_order ?? state.websiteProjects.length + 1, { type: "number", min: 0, step: "1" }) +
        '<h3 class="form-section-title">Tekst projekta</h3>' +
        field("Kratki opis", "excerpt", project?.excerpt, { type: "textarea", required: true, full: true }) +
        field("Puni opis", "description", project?.description, { type: "textarea", required: true, full: true, rows: 5 }) +
        field("Mehanizacija (odvojeno zarezom)", "equipment", (project?.equipment || []).join(", "), { full: true }) +
        field("Tehničke stavke (odvojeno zarezom)", "specs", (project?.specs || []).join(", "), { full: true }) +
        '<h3 class="form-section-title">Fotografije projekta</h3>' +
        existingMedia +
        `<label class="website-upload-field full"><span>Nova naslovna fotografija</span><input name="cover_image" type="file" accept="image/jpeg,image/png,image/webp" ${project ? "" : "required"}><small>Odaberi jednu glavnu fotografiju. Automatski se smanjuje i sprema kao WebP.</small></label>
         <label class="website-upload-field full"><span>Dodatne fotografije za galeriju</span><input name="gallery_images" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Možeš odabrati više fotografija odjednom. Prikazat će se unutar detalja projekta.</small></label>
         <div class="website-upload-note full"><strong>Kako radi?</strong><span>Naslovna fotografija prikazuje se na kartici projekta i velika je na vrhu detalja. Galerijske fotografije prikazuju se niže unutar projekta.</span></div>`,
      submit: async (data) => {
        const splitList = (name) => String(data.get(name) || "").split(",").map((item) => item.trim()).filter(Boolean);
        const title = formValue(data, "title");
        const generatedSlug = title.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const slug = formValue(data, "slug") || generatedSlug;
        const removedMedia = data.getAll("remove_media").map(String);
        const retainedImages = existingImages.filter((url) => !removedMedia.includes(url));
        const chosenExistingCover = String(data.get("existing_cover_choice") || "");
        const previousCover = project?.image && retainedImages.includes(project.image) ? project.image : "";
        const coverFile = data.get("cover_image");
        const galleryFiles = data.getAll("gallery_images").filter((file) => file instanceof File && file.size > 0);
        let coverImage = chosenExistingCover && retainedImages.includes(chosenExistingCover)
          ? chosenExistingCover
          : retainedImages[0] || "";
        let gallery = retainedImages.filter((url) => url !== coverImage);

        if (coverFile instanceof File && coverFile.size > 0) {
          coverImage = await uploadWebsiteImage(coverFile, slug, "cover");
          if (previousCover && !gallery.includes(previousCover)) gallery.unshift(previousCover);
        }
        if (galleryFiles.length) {
          const uploadedGallery = [];
          for (const file of galleryFiles) uploadedGallery.push(await uploadWebsiteImage(file, slug, "gallery"));
          if (!coverImage && uploadedGallery.length) coverImage = uploadedGallery.shift();
          gallery.push(...uploadedGallery);
        }
        if (!coverImage) throw new Error("Odaberi naslovnu fotografiju projekta.");

        const payload = {
          title,
          slug,
          category: data.get("category"),
          location: formValue(data, "location") || null,
          status: formValue(data, "status") || "Dovršeno",
          project_date: formValue(data, "project_date") || null,
          featured: data.get("featured") === "true",
          sort_order: Number(data.get("sort_order") || 0),
          image: coverImage,
          excerpt: formValue(data, "excerpt") || null,
          description: formValue(data, "description") || null,
          gallery: [...new Set(gallery.filter((url) => url !== coverImage))],
          equipment: splitList("equipment"),
          specs: splitList("specs")
        };
        const query = project
          ? client.from("website_projects").update(payload).eq("id", project.id)
          : client.from("website_projects").insert(payload);
        const { error } = await query;
        if (error) throw error;
        await removeWebsiteStorageFiles(removedMedia);
      }
    });
  }

  function renderWebsiteReviews() {
    const reviews = window.REVIEWS_DATA || [];
    app.innerHTML = pageHead(
      "JAVNI SADRŽAJ",
      "Recenzije",
      "Trenutne recenzije su demo podaci i zato su na javnoj stranici jasno označene."
    ) +
      `<div class="org-panels">${reviews.map((review) => `<article class="org-card">
        <div class="org-card-head"><h2>${esc(review.name)}</h2><span class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span></div>
        <p>${esc(review.text)}</p><small>${esc(review.source)} · DEMO</small>
      </article>`).join("") || empty("Nema recenzija.")}</div>
      <section class="org-card" style="margin-top:1.25rem"><p><strong>Gdje ih mijenjaš:</strong> <code>data/reviews-data.js</code>. Recenzije još nisu povezane s Google profilom niti zasebnom bazom.</p></section>`;
  }

  function renderWebsiteContent() {
    const company = { ...(window.COMPANY_DATA || {}), ...state.websiteSettings };
    const services = company.services || [];
    const advantages = company.advantages || [];
    const stats = company.stats || [];
    const equipment = company.equipment || [];
    const process = company.process || [];
    app.innerHTML = pageHead(
      "CENTRALNI PODACI",
      "Podaci firme",
      "Sve izmjene spremaju se u Supabase i automatski se koriste na javnoj web stranici.",
      '<a class="button button-ghost" href="/" target="_blank" rel="noopener">Pregledaj stranicu ↗</a>'
    ) +
      `<form class="website-content-form" id="website-content-form">
        ${contentSection("Osnovni podaci", "Naziv i osnovni identitet firme",
          field("Naziv firme", "name", company.name, { required: true }) +
          field("Kratki naziv / inicijali", "shortName", company.shortName, { required: true }) +
          field("Pravni naziv", "legalName", company.legalName, { required: true }) +
          field("Slogan", "slogan", company.slogan, { required: true, full: true })
        )}
        ${contentSection("Početna stranica", "Glavni naslov i uvodni tekst",
          field("Mali naslov iznad hero naslova", "eyebrow", company.eyebrow, { full: true }) +
          field("Glavni hero naslov", "heroTitle", company.heroTitle, { type: "textarea", required: true, full: true, rows: 3 }) +
          field("Hero opis", "heroText", company.heroText, { type: "textarea", required: true, full: true, rows: 4 })
        )}
        ${contentSection("O nama", "Tekstovi na početnoj i O nama stranici",
          field("Kratki opis firme", "about", company.about, { type: "textarea", required: true, full: true, rows: 5 }) +
          field("Prošireni opis firme", "aboutExtended", company.aboutExtended, { type: "textarea", required: true, full: true, rows: 6 })
        )}
        ${contentSection("Kontakt i pravni podaci", "Podaci prikazani na kontakt stranici i footeru",
          field("Telefon za prikaz", "phone", company.phone, { required: true }) +
          field("Telefon za tel: link", "phoneHref", company.phoneHref, { required: true }) +
          field("E-mail", "email", company.email, { type: "email", required: true }) +
          field("Adresa", "address", company.address, { required: true }) +
          field("Područje rada", "serviceArea", company.serviceArea, { required: true }) +
          field("Radno vrijeme", "workingHours", company.workingHours, { required: true }) +
          field("OIB", "oib", company.oib, { full: true })
        )}
        ${contentSection("SEO", "Naslov i opis koji koriste tražilice",
          field("SEO naslov", "seo_title", company.seo?.title, { required: true, full: true }) +
          field("SEO opis", "seo_description", company.seo?.description, { type: "textarea", required: true, full: true, rows: 3 })
        )}
        ${contentCollection("Usluge", "Četiri glavne usluge na početnoj stranici", services, (item, index) =>
          `<div class="content-repeat-card"><span class="content-repeat-number">${String(index + 1).padStart(2, "0")}</span>
            ${field("Naziv usluge", `service_${index}_title`, item.title, { required: true, full: true })}
            ${field("Opis usluge", `service_${index}_text`, item.text, { type: "textarea", required: true, full: true, rows: 3 })}
          </div>`
        )}
        ${contentCollection("Zašto odabrati GLAVAŠ KOP", "Kratke prednosti prikazane kao numerirane stavke", advantages, (item, index) =>
          `<div class="content-repeat-card"><span class="content-repeat-number">${String(index + 1).padStart(2, "0")}</span>
            ${field("Tekst prednosti", `advantage_${index}_label`, item.label, { required: true, full: true })}
          </div>`
        )}
        ${contentCollection("Statistike", "Broj i opis svake statistike", stats, (item, index) =>
          `<div class="content-repeat-card compact-repeat">
            ${field("Vrijednost", `stat_${index}_value`, item.value, { required: true })}
            ${field("Opis", `stat_${index}_label`, item.label, { required: true })}
          </div>`
        )}
        ${contentCollection("Mehanizacija", "Naziv, oznaka, opis i fotografija opreme", equipment, (item, index) =>
          `<div class="content-repeat-card equipment-repeat">
            <img class="content-image-preview" src="${esc(mediaUrl(item.image))}" alt="${esc(item.title || "Mehanizacija")}">
            ${field("Naziv", `equipment_${index}_title`, item.title, { required: true })}
            ${field("Oznaka", `equipment_${index}_tag`, item.tag, { required: true })}
            ${field("Opis", `equipment_${index}_text`, item.text, { type: "textarea", required: true, full: true, rows: 3 })}
            <label class="website-upload-field full"><span>Nova fotografija (opcionalno)</span><input name="equipment_${index}_image_file" type="file" accept="image/jpeg,image/png,image/webp"><small>Postojeća fotografija ostaje ako ne odabereš novu.</small></label>
            <input type="hidden" name="equipment_${index}_image" value="${esc(item.image || "")}">
          </div>`
        )}
        ${contentCollection("Proces rada", "Koraci od prvog upita do završetka", process, (item, index) =>
          `<div class="content-repeat-card"><span class="content-repeat-number">${String(index + 1).padStart(2, "0")}</span>
            ${field("Naslov koraka", `process_${index}_title`, item.title, { required: true, full: true })}
            ${field("Opis koraka", `process_${index}_text`, item.text, { type: "textarea", required: true, full: true, rows: 3 })}
          </div>`
        )}
        <div class="website-content-save"><p>Promjene postaju vidljive na javnoj stranici nakon spremanja i osvježavanja.</p><button class="button button-dark" type="submit">Spremi sve podatke firme</button></div>
      </form>`;
  }

  function contentSection(title, description, fields) {
    return `<section class="org-card website-content-section">
      <div class="org-card-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>
      <div class="form-grid">${fields}</div>
    </section>`;
  }

  function contentCollection(title, description, items, renderItem) {
    return `<section class="org-card website-content-section">
      <div class="org-card-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>
      <div class="content-repeat-grid">${items.map(renderItem).join("")}</div>
    </section>`;
  }

  async function saveWebsiteContent(form) {
    const data = new FormData(form);
    const current = { ...(window.COMPANY_DATA || {}), ...state.websiteSettings };
    const read = (name) => String(data.get(name) || "").trim();
    const services = (current.services || []).map((item, index) => ({
      ...item,
      number: String(index + 1).padStart(2, "0"),
      title: read(`service_${index}_title`),
      text: read(`service_${index}_text`)
    }));
    const advantages = (current.advantages || []).map((item, index) => ({
      ...item,
      value: String(index + 1).padStart(2, "0"),
      label: read(`advantage_${index}_label`)
    }));
    const stats = (current.stats || []).map((item, index) => ({
      ...item,
      value: read(`stat_${index}_value`),
      label: read(`stat_${index}_label`)
    }));
    const equipment = [];
    for (let index = 0; index < (current.equipment || []).length; index += 1) {
      const imageFile = data.get(`equipment_${index}_image_file`);
      let image = read(`equipment_${index}_image`);
      if (imageFile instanceof File && imageFile.size > 0) {
        image = await uploadWebsiteImage(imageFile, "company", `equipment-${index + 1}`);
      }
      equipment.push({
        ...current.equipment[index],
        title: read(`equipment_${index}_title`),
        tag: read(`equipment_${index}_tag`),
        text: read(`equipment_${index}_text`),
        image
      });
    }
    const process = (current.process || []).map((item, index) => ({
      ...item,
      step: String(index + 1).padStart(2, "0"),
      title: read(`process_${index}_title`),
      text: read(`process_${index}_text`)
    }));
    const payload = {
      ...current,
      name: read("name"),
      shortName: read("shortName"),
      legalName: read("legalName"),
      slogan: read("slogan"),
      eyebrow: read("eyebrow"),
      heroTitle: read("heroTitle"),
      heroText: read("heroText"),
      about: read("about"),
      aboutExtended: read("aboutExtended"),
      phone: read("phone"),
      phoneHref: read("phoneHref"),
      email: read("email"),
      address: read("address"),
      serviceArea: read("serviceArea"),
      workingHours: read("workingHours"),
      oib: read("oib"),
      seo: { title: read("seo_title"), description: read("seo_description") },
      services,
      advantages,
      stats,
      equipment,
      process
    };
    const { error } = await client.from("website_settings").upsert({ id: "company", data: payload });
    if (error) throw error;
    state.websiteSettings = payload;
    Object.assign(window.COMPANY_DATA, payload);
  }

  function stat(value, label, highlight = false) {
    return `<article class="org-stat ${highlight ? "highlight" : ""}"><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`;
  }

  function listPanel(title, rows, emptyText) {
    return `<section class="org-card"><div class="org-card-head"><h2>${esc(title)}</h2></div><div class="org-list">${
      rows.length ? rows.map(([titleValue, subtitle, meta]) => `<div class="org-list-item"><span><strong>${esc(titleValue)}</strong><small>${esc(subtitle)}</small></span><strong>${esc(meta)}</strong></div>`).join("") : empty(emptyText)
    }</div></section>`;
  }

  function renderEmployees() {
    app.innerHTML = pageHead("MITARBEITER / RADNICI", "Radnici", "Satnice, angažmani, zarada i isplate po radniku.",
      '<button class="button button-dark" data-action="new-employee">+ Dodaj radnika</button>') +
      `<div class="org-toolbar"><input type="search" id="employee-search" placeholder="Pretraži radnike…"><select id="employee-status"><option value="">Svi statusi</option><option value="active">Aktivni</option><option value="inactive">Neaktivni</option></select></div>
      <div class="org-table-wrap"><table class="org-table"><thead><tr><th>Radnik</th><th>Kontakt / uloga</th><th>Satnica</th><th>Zarađeno ovaj mjesec</th><th>Isplaćeno</th><th>Još za platiti</th><th>Projekti</th><th>Akcije</th></tr></thead><tbody id="employee-rows"></tbody></table></div>`;
    drawEmployeeRows();
  }

  function drawEmployeeRows() {
    const target = document.getElementById("employee-rows");
    if (!target) return;
    const query = document.getElementById("employee-search")?.value.toLowerCase().trim() || "";
    const filter = document.getElementById("employee-status")?.value || "";
    const rows = state.employees.filter((employee) => {
      const matches = [employee.name, employee.phone, employee.role].some((value) => String(value || "").toLowerCase().includes(query));
      const statusMatches = !filter || (filter === "active" ? employee.active : !employee.active);
      return matches && statusMatches;
    });
    target.innerHTML = rows.length ? rows.map((employee) => {
      const earned = earnedForEmployee(employee, true);
      const paid = paidForEmployee(employee, true);
      const projectCount = new Set(state.workers.filter((item) => item.employee_id === employee.id).map((item) => item.project_id)).size;
      return `<tr>
        <td><strong>${esc(employee.name)}</strong><br>${employee.active ? statusBadge("active") : '<span class="status-badge status-cancelled">Neaktivan</span>'}</td>
        <td>${esc(employee.role || "Nije uneseno")}<br><small>${esc(employee.phone || "Bez telefona")}</small></td>
        <td>${currency.format(employee.hourly_rate || 0)}</td>
        <td>${currency.format(earned)}</td><td>${currency.format(paid)}</td><td><strong>${currency.format(Math.max(earned - paid, 0))}</strong></td>
        <td>${projectCount}</td>
        <td><div class="org-table-actions"><button class="org-icon-button" data-edit-employee="${employee.id}">Uredi</button><button class="org-icon-button" data-toggle-employee="${employee.id}">${employee.active ? "Deaktiviraj" : "Aktiviraj"}</button><button class="org-icon-button danger" data-delete-employee="${employee.id}">Briši</button></div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="8">${empty("Nema radnika za odabrani filter.")}</td></tr>`;
  }

  function employeeModal(employee) {
    openModal({
      title: employee ? "Uredi radnika" : "Novi radnik",
      fields:
        field("Ime i prezime", "name", employee?.name, { required: true, full: true }) +
        field("Telefon", "phone", employee?.phone, { type: "tel" }) +
        field("Uloga", "role", employee?.role) +
        field("Satnica (€)", "hourly_rate", employee?.hourly_rate || 0, { type: "number", min: 0, step: "0.01" }) +
        field("Status", "active", String(employee?.active ?? true), { type: "select", choices: [["true", "Aktivan"], ["false", "Neaktivan"]] }) +
        field("Napomene", "notes", employee?.notes, { type: "textarea", full: true }),
      submit: async (data) => {
        const payload = {
          name: formValue(data, "name"),
          phone: formValue(data, "phone") || null,
          role: formValue(data, "role") || null,
          hourly_rate: Number(data.get("hourly_rate") || 0),
          active: data.get("active") === "true",
          notes: formValue(data, "notes") || null
        };
        const query = employee ? client.from("employees").update(payload).eq("id", employee.id) : client.from("employees").insert(payload);
        const { error } = await query;
        if (error) throw error;
      }
    });
  }

  function renderProjects() {
    app.innerHTML = pageHead("PRIVATNA EVIDENCIJA", "Interni projekti", "Cijene, mjere, radnici, dokumenti i privatne napomene nisu dostupni javnoj stranici.",
      '<button class="button button-dark" data-action="new-project">+ Novi projekt</button>') +
      `<div class="org-toolbar"><input type="search" id="project-search" placeholder="Pretraži projekte…"><select id="project-status"><option value="">Svi statusi</option>${["planned","active","finished","paid","cancelled"].map((value) => `<option value="${value}">${statusLabel[value]}</option>`).join("")}</select></div>
      <div class="org-table-wrap"><table class="org-table"><thead><tr><th>Projekt</th><th>Vrsta / status</th><th>Cijena</th><th>Površina</th><th>Volumen</th><th>Radnici</th><th>Sljedeći termin</th><th>Akcije</th></tr></thead><tbody id="project-rows"></tbody></table></div>`;
    drawProjectRows();
  }

  function drawProjectRows() {
    const target = document.getElementById("project-rows");
    if (!target) return;
    const query = document.getElementById("project-search")?.value.toLowerCase().trim() || "";
    const filter = document.getElementById("project-status")?.value || "";
    const rows = state.projects.filter((project) =>
      [project.title, project.location, project.job_type].some((value) => String(value || "").toLowerCase().includes(query)) &&
      (!filter || project.status === filter)
    );
    target.innerHTML = rows.length ? rows.map((project) => {
      const workerCount = state.workers.filter((item) => item.project_id === project.id).length;
      const next = state.events.find((item) => item.project_id === project.id && new Date(item.start_time) > new Date() && item.status === "planned");
      return `<tr>
        <td><button class="org-icon-button" data-view-project="${project.id}"><strong>${esc(project.title)}</strong></button><br><small>${esc(project.location || "Bez lokacije")}</small></td>
        <td>${esc(project.job_type || "Nije uneseno")}<br>${statusBadge(project.status)}</td>
        <td>${currency.format(project.price || 0)}</td><td>${project.area_m2 == null ? "—" : `${number.format(project.area_m2)} m²`}</td><td>${project.excavation_volume_m3 == null ? "—" : `${number.format(project.excavation_volume_m3)} m³`}</td>
        <td>${workerCount}</td><td>${next ? dateTimeFormatter.format(new Date(next.start_time)) : "—"}</td>
        <td><div class="org-table-actions"><button class="org-icon-button" data-view-project="${project.id}">Pregled</button><button class="org-icon-button" data-edit-project="${project.id}">Uredi</button><button class="org-icon-button danger" data-delete-project="${project.id}">Briši</button></div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="8">${empty("Nema internih projekata za odabrani filter.")}</td></tr>`;
  }

  function projectModal(project) {
    const fields =
      '<h3 class="form-section-title">Osnovne informacije</h3>' +
      field("Naziv projekta", "title", project?.title, { required: true, full: true }) +
      field("Lokacija", "location", project?.location) +
      field("Vrsta posla", "job_type", project?.job_type) +
      field("Status", "status", project?.status || "planned", { type: "select", choices: ["planned","active","finished","paid","cancelled"].map((value) => [value, statusLabel[value]]) }) +
      field("Cijena (€)", "price", project?.price || 0, { type: "number", min: 0, step: "0.01" }) +
      field("Procijenjeno trajanje", "estimated_duration", project?.estimated_duration) +
      field("Početak", "start_date", project?.start_date, { type: "date" }) +
      field("Završetak", "end_date", project?.end_date, { type: "date" }) +
      field("Opis", "description", project?.description, { type: "textarea", full: true }) +
      '<h3 class="form-section-title">Tehničke mjere</h3>' +
      field("Dužina terena (m)", "yard_length", project?.yard_length, { type: "number", min: 0, step: "0.01" }) +
      field("Širina terena (m)", "yard_width", project?.yard_width, { type: "number", min: 0, step: "0.01" }) +
      field("Dubina iskopa (m)", "excavation_depth", project?.excavation_depth, { type: "number", min: 0, step: "0.01" }) +
      '<div class="calculation-preview"><span>Površina: <strong id="area-preview">—</strong></span><span>Volumen iskopa: <strong id="volume-preview">—</strong></span></div>' +
      '<h3 class="form-section-title">Dodatne informacije</h3>' +
      field("Interne napomene", "extra_info", project?.extra_info, { type: "textarea", full: true, rows: 5 });
    openModal({
      title: project ? "Uredi interni projekt" : "Novi interni projekt",
      fields,
      afterOpen: () => {
        const calculate = () => {
          const length = Number(modalForm.elements.yard_length.value);
          const width = Number(modalForm.elements.yard_width.value);
          const depth = Number(modalForm.elements.excavation_depth.value);
          document.getElementById("area-preview").textContent = length && width ? `${number.format(length * width)} m²` : "—";
          document.getElementById("volume-preview").textContent = length && width && depth ? `${number.format(length * width * depth)} m³` : "—";
        };
        ["yard_length", "yard_width", "excavation_depth"].forEach((name) => modalForm.elements[name].addEventListener("input", calculate));
        calculate();
      },
      submit: async (data) => {
        const numericOrNull = (name) => formValue(data, name) === "" ? null : Number(data.get(name));
        const payload = {
          title: formValue(data, "title"),
          location: formValue(data, "location") || null,
          job_type: formValue(data, "job_type") || null,
          status: data.get("status"),
          price: Number(data.get("price") || 0),
          estimated_duration: formValue(data, "estimated_duration") || null,
          description: formValue(data, "description") || null,
          start_date: data.get("start_date") || null,
          end_date: data.get("end_date") || null,
          yard_length: numericOrNull("yard_length"),
          yard_width: numericOrNull("yard_width"),
          excavation_depth: numericOrNull("excavation_depth"),
          extra_info: formValue(data, "extra_info") || null
        };
        const query = project ? client.from("internal_projects").update(payload).eq("id", project.id) : client.from("internal_projects").insert(payload);
        const { error } = await query;
        if (error) throw error;
      }
    });
  }

  async function renderProjectDetail(projectId) {
    const project = getProject(projectId);
    if (!project) {
      navigate("/admin/organizer/projekte");
      return;
    }
    const workers = state.workers.filter((item) => item.project_id === project.id);
    const projectPayments = state.payments.filter((item) => item.project_id === project.id);
    const projectExpenses = state.expenses.filter((item) => item.project_id === project.id);
    const files = state.files.filter((item) => item.project_id === project.id);
    const events = state.events.filter((item) => item.project_id === project.id);
    const images = files.filter((item) => item.is_image);
    const documents = files.filter((item) => !item.is_image);
    const coverImage = images.find((item) => item.is_cover) || images[0] || null;
    const galleryImages = images.filter((item) => item.id !== coverImage?.id);
    const coverUrl = coverImage ? await signedFileUrl(coverImage) : "";
    const imageCards = await Promise.all(galleryImages.map(fileCard));
    const documentCards = await Promise.all(documents.map(fileCard));

    app.innerHTML = pageHead("DETALJI PROJEKTA", project.title, project.location || "Lokacija nije unesena",
      `<button class="button button-ghost" data-action="back-projects">← Projekti</button><button class="button button-dark" data-edit-project="${project.id}">Uredi projekt</button>`) +
      `<div class="project-detail-grid">
        <div>
          <section class="org-card">
            <div class="org-card-head"><h2>Osnovne informacije</h2>${statusBadge(project.status)}</div>
            <div class="project-measures">
              ${measure("Vrsta posla", project.job_type || "—")}
              ${measure("Cijena", currency.format(project.price || 0))}
              ${measure("Trajanje", project.estimated_duration || "—")}
              ${measure("Razdoblje", `${project.start_date ? dateFormatter.format(new Date(`${project.start_date}T12:00:00`)) : "—"} – ${project.end_date ? dateFormatter.format(new Date(`${project.end_date}T12:00:00`)) : "—"}`)}
            </div>
            <p>${esc(project.description || "Opis nije unesen.")}</p>
          </section>
          <section class="org-card project-files-card" style="margin-top:1.2rem">
            <div class="org-card-head project-files-heading">
              <div><h2>Slike i nacrti</h2><p>Privatna galerija projekta i dokumentacija dostupna samo prijavljenom vlasniku.</p></div>
              <span class="file-count">${fileCountLabel(images.length, "slika", "slike", "slika")} · ${fileCountLabel(documents.length, "dokument", "dokumenta", "dokumenata")}</span>
            </div>
            <label class="upload-zone" id="upload-zone">
              <input type="file" id="project-files-input" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden>
              <span class="upload-zone-icon" aria-hidden="true">+</span>
              <span class="upload-zone-copy">
                <strong>Dodaj slike ili PDF nacrte</strong>
                <small>Klikni ovdje ili dovuci datoteke. Slike se automatski smanjuju i komprimiraju.</small>
                <em>JPG, PNG, WebP ili PDF do 20 MB</em>
              </span>
              <span class="upload-zone-button">Odaberi datoteke</span>
            </label>
            <div class="upload-progress" hidden id="upload-progress"><span></span></div>
            ${files.length ? `
              <div class="project-media-sections">
                <section class="cover-section">
                  <div class="file-section-heading">
                    <div><span class="file-section-kicker">GLAVNA FOTOGRAFIJA</span><h3>Vizualni pregled projekta</h3></div>
                    <p>Prikazuje se prva u ovom internom projektu. Ne objavljuje se automatski na javnoj web stranici.</p>
                  </div>
                  ${coverImage ? `
                    <article class="cover-preview">
                      <img src="${esc(coverUrl)}" alt="${esc(coverImage.original_file_name || "Glavna fotografija projekta")}">
                      <div class="cover-preview-overlay"><span>Glavna fotografija</span><strong>${esc(coverImage.original_file_name || coverImage.file_name)}</strong></div>
                      <div class="cover-preview-actions"><button class="org-icon-button" data-open-file="${coverImage.id}">Otvori</button><button class="org-icon-button danger" data-delete-file="${coverImage.id}">Obriši</button></div>
                    </article>` : empty("Dodaj sliku kako bi projekt dobio glavnu fotografiju.")}
                </section>
                <section class="file-section">
                  <div class="file-section-heading"><div><span class="file-section-kicker">GALERIJA</span><h3>Ostale fotografije</h3></div><p>Klikni “Postavi kao glavnu” ako želiš zamijeniti veliku fotografiju iznad.</p></div>
                  <div class="file-grid image-grid">${imageCards.join("") || empty("Nema dodatnih fotografija.")}</div>
                </section>
                <section class="file-section">
                  <div class="file-section-heading"><div><span class="file-section-kicker">DOKUMENTACIJA</span><h3>Nacrti i PDF dokumenti</h3></div></div>
                  <div class="document-list">${documentCards.join("") || empty("Nema dodanih nacrta ni dokumenata.")}</div>
                </section>
              </div>` : `<div class="files-empty-state"><span>SLIKE / PDF</span><h3>Projekt još nema datoteka</h3><p>Dodaj fotografije radova, nacrte ili drugu projektnu dokumentaciju pomoću polja iznad.</p></div>`}
          </section>
        </div>
        <div>
          <section class="org-card">
            <div class="org-card-head"><h2>Tehničke mjere</h2></div>
            <div class="project-measures">
              ${measure("Dužina", project.yard_length == null ? "—" : `${number.format(project.yard_length)} m`)}
              ${measure("Širina", project.yard_width == null ? "—" : `${number.format(project.yard_width)} m`)}
              ${measure("Površina", project.area_m2 == null ? "—" : `${number.format(project.area_m2)} m²`)}
              ${measure("Dubina", project.excavation_depth == null ? "—" : `${number.format(project.excavation_depth)} m`)}
              ${measure("Volumen", project.excavation_volume_m3 == null ? "—" : `${number.format(project.excavation_volume_m3)} m³`)}
            </div>
            <p><strong>Interne napomene</strong><br>${esc(project.extra_info || "Nema dodatnih napomena.")}</p>
          </section>
          <section class="org-card" style="margin-top:1.2rem">
            <div class="org-card-head"><h2>Radnici</h2><button class="org-icon-button" data-add-worker="${project.id}">+ Poveži</button></div>
            <div class="org-list">${workers.length ? workers.map((item) => `<div class="org-list-item"><span><strong>${esc(getEmployee(item.employee_id)?.name || "Radnik")}</strong><small>${number.format(item.hours_worked)} h · ${esc(item.note || "")}</small></span><span><strong>${currency.format(item.agreed_amount || Number(item.hours_worked) * Number(getEmployee(item.employee_id)?.hourly_rate || 0))}</strong><button class="org-icon-button danger" data-remove-worker="${item.id}">×</button></span></div>`).join("") : empty("Nema povezanih radnika.")}</div>
          </section>
          ${listPanel("Termini projekta", events.slice(0, 5).map((item) => [item.title, dateTimeFormatter.format(new Date(item.start_time)), eventTypeLabel[item.type]]), "Nema povezanih termina.")}
          ${listPanel("Financije", [["Isplate", `${projectPayments.length} zapisa`, currency.format(projectPayments.reduce((sum, item) => sum + Number(item.amount), 0))], ["Troškovi", `${projectExpenses.length} zapisa`, currency.format(projectExpenses.reduce((sum, item) => sum + Number(item.amount), 0))]], "")}
        </div>
      </div>`;
    setupUpload(project);
  }

  function measure(label, value) {
    return `<div class="project-measure"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
  }

  function workerModal(projectId) {
    const available = state.employees.filter((employee) => employee.active && !state.workers.some((item) => item.project_id === projectId && item.employee_id === employee.id));
    if (!available.length) {
      toast("Nema dostupnih aktivnih radnika za povezivanje.", "error");
      return;
    }
    openModal({
      title: "Poveži radnika s projektom",
      fields:
        field("Radnik", "employee_id", available[0].id, { type: "select", full: true, choices: available.map((item) => [item.id, `${item.name} · ${item.role || "radnik"}`]) }) +
        field("Odrađeni sati", "hours_worked", 0, { type: "number", min: 0, step: "0.25" }) +
        field("Dogovoreni iznos (€)", "agreed_amount", 0, { type: "number", min: 0, step: "0.01" }) +
        field("Napomena", "note", "", { type: "textarea", full: true }),
      submit: async (data) => {
        const { error } = await client.from("project_workers").insert({
          project_id: projectId,
          employee_id: data.get("employee_id"),
          hours_worked: Number(data.get("hours_worked") || 0),
          agreed_amount: Number(data.get("agreed_amount") || 0),
          note: formValue(data, "note") || null
        });
        if (error) throw error;
      }
    });
  }

  function renderPayments() {
    app.innerHTML = pageHead("FINANCIJE RADNIKA", "Isplate", "Evidencija isplata, povezanih projekata i preostalog iznosa.",
      '<button class="button button-dark" data-action="new-payment">+ Dodaj isplatu</button>') +
      `<div class="org-table-wrap"><table class="org-table"><thead><tr><th>Radnik</th><th>Projekt</th><th>Iznos</th><th>Datum</th><th>Napomena</th><th>Akcije</th></tr></thead><tbody>${
        state.payments.length ? state.payments.map((item) => `<tr><td><strong>${esc(getEmployee(item.employee_id)?.name || "Nepoznat radnik")}</strong></td><td>${esc(getProject(item.project_id)?.title || "Opća isplata")}</td><td><strong>${currency.format(item.amount)}</strong></td><td>${dateFormatter.format(new Date(`${item.paid_at}T12:00:00`))}</td><td>${esc(item.note || "—")}</td><td><div class="org-table-actions"><button class="org-icon-button" data-edit-payment="${item.id}">Uredi</button><button class="org-icon-button danger" data-delete-payment="${item.id}">Briši</button></div></td></tr>`).join("") : `<tr><td colspan="6">${empty("Nema evidentiranih isplata.")}</td></tr>`
      }</tbody></table></div>`;
  }

  function paymentModal(payment) {
    if (!state.employees.length) {
      toast("Prvo dodajte barem jednog radnika.", "error");
      return;
    }
    openModal({
      title: payment ? "Uredi isplatu" : "Nova isplata",
      fields:
        field("Radnik", "employee_id", payment?.employee_id || state.employees[0].id, { type: "select", choices: state.employees.map((item) => [item.id, item.name]), full: true }) +
        field("Projekt (opcionalno)", "project_id", payment?.project_id || "", { type: "select", choices: [["", "Opća isplata"], ...state.projects.map((item) => [item.id, item.title])], full: true }) +
        field("Iznos (€)", "amount", payment?.amount, { type: "number", min: 0.01, step: "0.01", required: true }) +
        field("Datum isplate", "paid_at", payment?.paid_at || isoDate(new Date()), { type: "date", required: true }) +
        field("Napomena", "note", payment?.note, { type: "textarea", full: true }),
      submit: async (data) => {
        const payload = { employee_id: data.get("employee_id"), project_id: data.get("project_id") || null, amount: Number(data.get("amount")), paid_at: data.get("paid_at"), note: formValue(data, "note") || null };
        const query = payment ? client.from("employee_payments").update(payload).eq("id", payment.id) : client.from("employee_payments").insert(payload);
        const { error } = await query;
        if (error) throw error;
      }
    });
  }

  function renderExpenses() {
    const total = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    app.innerHTML = pageHead("POSLOVNI TROŠKOVI", "Troškovi", `Ukupno evidentirano: ${currency.format(total)}`,
      '<button class="button button-dark" data-action="new-expense">+ Dodaj trošak</button>') +
      `<div class="org-table-wrap"><table class="org-table"><thead><tr><th>Trošak</th><th>Kategorija</th><th>Projekt</th><th>Iznos</th><th>Datum</th><th>Napomena</th><th>Akcije</th></tr></thead><tbody>${
        state.expenses.length ? state.expenses.map((item) => `<tr><td><strong>${esc(item.title)}</strong></td><td>${esc(item.category || "Ostalo")}</td><td>${esc(getProject(item.project_id)?.title || "Opći trošak")}</td><td><strong>${currency.format(item.amount)}</strong></td><td>${dateFormatter.format(new Date(`${item.expense_date}T12:00:00`))}</td><td>${esc(item.note || "—")}</td><td><div class="org-table-actions"><button class="org-icon-button" data-edit-expense="${item.id}">Uredi</button><button class="org-icon-button danger" data-delete-expense="${item.id}">Briši</button></div></td></tr>`).join("") : `<tr><td colspan="7">${empty("Nema evidentiranih troškova.")}</td></tr>`
      }</tbody></table></div>`;
  }

  function expenseModal(expense) {
    openModal({
      title: expense ? "Uredi trošak" : "Novi trošak",
      fields:
        field("Naziv troška", "title", expense?.title, { required: true, full: true }) +
        field("Kategorija", "category", expense?.category || "gorivo", { type: "select", choices: ["gorivo","materijal","najam stroja","servis","prijevoz","radnici","ostalo"].map((value) => [value, value.charAt(0).toUpperCase() + value.slice(1)]) }) +
        field("Projekt", "project_id", expense?.project_id || "", { type: "select", choices: [["", "Opći trošak"], ...state.projects.map((item) => [item.id, item.title])] }) +
        field("Iznos (€)", "amount", expense?.amount, { type: "number", min: 0.01, step: "0.01", required: true }) +
        field("Datum", "expense_date", expense?.expense_date || isoDate(new Date()), { type: "date", required: true }) +
        field("Napomena", "note", expense?.note, { type: "textarea", full: true }),
      submit: async (data) => {
        const payload = { title: formValue(data, "title"), category: data.get("category"), project_id: data.get("project_id") || null, amount: Number(data.get("amount")), expense_date: data.get("expense_date"), note: formValue(data, "note") || null };
        const query = expense ? client.from("expenses").update(payload).eq("id", expense.id) : client.from("expenses").insert(payload);
        const { error } = await query;
        if (error) throw error;
      }
    });
  }

  async function renderFiles() {
    const cards = await Promise.all(state.files.map(fileCard));
    app.innerHTML = pageHead("PRIVATNI STORAGE", "Nacrti / dokumenti", "Datoteke su u privatnom Supabase bucketu i otvaraju se samo privremenim signed URL-om.") +
      `<div class="file-grid">${cards.join("") || empty("Nema uploadanih datoteka. Dodajte ih unutar detalja internog projekta.")}</div>`;
  }

  async function signedFileUrl(item) {
    const { data } = await client.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 300);
    return data?.signedUrl || "";
  }

  async function fileCard(item) {
    const url = item.is_image ? await signedFileUrl(item) : "";
    const original = Number(item.original_size_bytes || item.file_size_bytes || 0);
    const compressed = Number(item.compressed_size_bytes || item.file_size_bytes || 0);
    const saving = original > compressed ? Math.round((1 - compressed / original) * 100) : 0;
    return `<article class="file-card ${item.is_image ? "image-file-card" : "document-file-card"}">
      ${item.is_image ? `<div class="file-card-image"><img src="${esc(url)}" alt="${esc(item.original_file_name || "Projektna slika")}" loading="lazy">${item.is_cover ? '<span class="cover-badge">Glavna</span>' : ""}</div>` : '<div class="document-icon" aria-hidden="true"><strong>PDF</strong><span>Dokument</span></div>'}
      <div class="file-card-body">
        <strong>${esc(item.original_file_name || item.file_name)}</strong>
        <small>${esc(getProject(item.project_id)?.title || "Projekt")} · ${formatBytes(compressed)}${saving ? ` · ${saving}% manje` : ""}</small>
        <div class="file-actions"><button class="org-icon-button" data-open-file="${item.id}">Otvori</button>${item.is_image && !item.is_cover ? `<button class="org-icon-button cover-action" data-cover-file="${item.id}">Postavi kao glavnu</button>` : ""}<button class="org-icon-button danger" data-delete-file="${item.id}">Obriši</button></div>
      </div>
    </article>`;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function fileCountLabel(count, singular, paucal, plural) {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return `${count} ${plural}`;
    if (last === 1) return `${count} ${singular}`;
    if (last >= 2 && last <= 4) return `${count} ${paucal}`;
    return `${count} ${plural}`;
  }

  function renderCalendar() {
    const title = calendarCursor.toLocaleDateString("hr-HR", calendarView === "month"
      ? { month: "long", year: "numeric" }
      : { dateStyle: "long" });
    app.innerHTML = pageHead("EUROPE/ZAGREB", "Kalendar", "Poslovi, sastanci, rokovi, servisi, privatni termini i hrvatski blagdani.",
      '<button class="button button-dark" data-action="new-event">+ Dodaj termin</button>') +
      `<div class="calendar-shell">
        <section class="calendar-main">
          <div class="calendar-nav">
            <div><button class="org-icon-button" data-calendar-nav="-1">←</button> <button class="org-icon-button" data-calendar-today>Danas</button> <button class="org-icon-button" data-calendar-nav="1">→</button></div>
            <h2>${esc(title)}</h2>
            <div class="calendar-view-buttons">${["month","week","day","list"].map((view) => `<button class="org-icon-button ${calendarView === view ? "active" : ""}" data-calendar-view="${view}">${{month:"Mjesec",week:"Tjedan",day:"Dan",list:"Lista"}[view]}</button>`).join("")}</div>
          </div>
          <div id="calendar-view">${calendarContent()}</div>
        </section>
        <aside class="calendar-side">
          <h3>Današnji termini</h3>
          <div class="calendar-list">${eventList(state.events.filter((item) => isoDate(new Date(item.start_time)) === isoDate(new Date()) && item.status !== "cancelled"))}</div>
        </aside>
      </div>`;
  }

  function calendarContent() {
    if (calendarView === "month") return monthCalendar();
    if (calendarView === "week") return weekCalendar();
    if (calendarView === "day") return `<div class="day-timeline"><h3>${esc(calendarCursor.toLocaleDateString("hr-HR", { dateStyle: "full" }))}</h3>${eventList(eventsForDate(calendarCursor), true)}</div>`;
    return `<div class="calendar-list">${eventList(state.events.filter((item) => new Date(item.start_time) >= new Date()).slice(0, 50), true)}</div>`;
  }

  function monthCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const weekdays = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
    let html = `<div class="calendar-grid">${weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}`;
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = isoDate(date);
      const holiday = state.holidays.find((item) => item.date === dateKey);
      const events = eventsForDate(date);
      const classes = [date.getMonth() !== month ? "outside" : "", dateKey === isoDate(new Date()) ? "today" : "", holiday ? "holiday" : ""].filter(Boolean).join(" ");
      html += `<div class="calendar-day ${classes}" data-new-event-date="${dateKey}"><span class="day-number">${date.getDate()}</span>${holiday ? `<button class="calendar-event holiday-event" title="${esc(holiday.name)}">${esc(holiday.name)}</button>` : ""}${events.slice(0, 3).map(calendarEventButton).join("")}${events.length > 3 ? `<small>+${events.length - 3} više</small>` : ""}</div>`;
    }
    return `${html}</div>`;
  }

  function weekCalendar() {
    const cursor = new Date(calendarCursor);
    const offset = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - offset);
    let html = '<div class="calendar-week">';
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      html += `<div class="week-day-column" data-new-event-date="${isoDate(date)}"><h3>${esc(date.toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" }))}</h3>${eventList(eventsForDate(date), true)}</div>`;
    }
    return `${html}</div>`;
  }

  function eventsForDate(date) {
    const key = isoDate(date);
    return state.events.filter((item) => isoDate(new Date(item.start_time)) === key && item.status !== "cancelled");
  }

  function calendarEventButton(item) {
    return `<button class="calendar-event" data-edit-event="${item.id}" title="${esc(item.title)}">${esc(item.title)}</button>`;
  }

  function eventList(items, buttons = false) {
    if (!items.length) return empty("Nema termina.");
    return items.map((item) => buttons
      ? `<button class="calendar-event" data-edit-event="${item.id}"><strong>${esc(item.title)}</strong><br>${esc(dateTimeFormatter.format(new Date(item.start_time)))}</button>`
      : `<div class="org-list-item"><span><strong>${esc(item.title)}</strong><small>${esc(dateTimeFormatter.format(new Date(item.start_time)))}</small></span><span>${esc(eventTypeLabel[item.type])}</span></div>`
    ).join("");
  }

  function eventModal(event, presetDate) {
    const startDefault = event?.start_time || `${presetDate || isoDate(new Date())}T08:00:00`;
    openModal({
      title: event ? "Uredi termin" : "Novi termin",
      fields:
        field("Naslov", "title", event?.title, { required: true, full: true }) +
        field("Početak", "start_time", localInputValue(startDefault), { type: "datetime-local", required: true }) +
        field("Završetak", "end_time", localInputValue(event?.end_time), { type: "datetime-local" }) +
        field("Cijeli dan", "all_day", String(event?.all_day || false), { type: "select", choices: [["false", "Ne"], ["true", "Da"]] }) +
        field("Vrsta", "type", event?.type || "work", { type: "select", choices: Object.entries(eventTypeLabel).filter(([value]) => value !== "holiday") }) +
        field("Status", "status", event?.status || "planned", { type: "select", choices: [["planned", "Planirano"], ["done", "Gotovo"], ["cancelled", "Otkazano"]] }) +
        field("Lokacija", "location", event?.location) +
        field("Podsjetnik (minuta prije)", "reminder_minutes", event?.reminder_minutes ?? 15, { type: "number", min: 0, step: "1" }) +
        field("Podsjetnik uključen", "reminder_enabled", String(event?.reminder_enabled ?? true), { type: "select", choices: [["true", "Da"], ["false", "Ne"]] }) +
        field("Projekt", "project_id", event?.project_id || "", { type: "select", choices: [["", "Bez projekta"], ...state.projects.map((item) => [item.id, item.title])] }) +
        field("Radnik", "employee_id", event?.employee_id || "", { type: "select", choices: [["", "Bez radnika"], ...state.employees.map((item) => [item.id, item.name])] }) +
        field("Opis", "description", event?.description, { type: "textarea", full: true }),
      submit: async (data) => {
        const payload = {
          title: formValue(data, "title"),
          start_time: new Date(data.get("start_time")).toISOString(),
          end_time: data.get("end_time") ? new Date(data.get("end_time")).toISOString() : null,
          all_day: data.get("all_day") === "true",
          type: data.get("type"),
          status: data.get("status"),
          location: formValue(data, "location") || null,
          reminder_minutes: Number(data.get("reminder_minutes") || 15),
          reminder_enabled: data.get("reminder_enabled") === "true",
          project_id: data.get("project_id") || null,
          employee_id: data.get("employee_id") || null,
          description: formValue(data, "description") || null
        };
        const query = event ? client.from("calendar_events").update(payload).eq("id", event.id) : client.from("calendar_events").insert(payload);
        const { error } = await query;
        if (error) throw error;
      },
      deleteAction: event ? async () => {
        if (!confirm(`Obrisati termin "${event.title}"?`)) return false;
        const { error } = await client.from("calendar_events").delete().eq("id", event.id);
        if (error) throw error;
        return true;
      } : null
    });
  }

  function passwordModal() {
    openModal({
      title: "Promijeni lozinku",
      eyebrow: "SIGURNOST RAČUNA",
      fields:
        field("Nova lozinka", "password", "", { type: "password", required: true, full: true }) +
        field("Ponovite novu lozinku", "password_confirmation", "", { type: "password", required: true, full: true }),
      submit: async (data) => {
        const password = String(data.get("password"));
        const confirmation = String(data.get("password_confirmation"));
        if (password.length < 10) throw new Error("Lozinka mora imati najmanje 10 znakova.");
        if (password !== confirmation) throw new Error("Lozinke se ne podudaraju.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
      }
    });
  }

  function setupUpload(project) {
    const input = document.getElementById("project-files-input");
    const zone = document.getElementById("upload-zone");
    input?.addEventListener("change", () => uploadFiles(project, [...input.files]));
    ["dragenter", "dragover"].forEach((type) => zone?.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((type) => zone?.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
    }));
    zone?.addEventListener("drop", (event) => uploadFiles(project, [...event.dataTransfer.files]));
  }

  async function uploadFiles(project, files) {
    const accepted = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const progress = document.getElementById("upload-progress");
    const bar = progress.querySelector("span");
    progress.hidden = false;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!accepted.includes(file.type)) throw new Error(`${file.name}: dopuštene su JPG, PNG, WebP i PDF datoteke.`);
        if (file.type === "application/pdf" && file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: PDF je veći od 20 MB.`);
        const isImage = file.type.startsWith("image/");
        const compressed = isImage ? await compressImage(file) : { file, originalSize: file.size, compressedSize: file.size };
        const folder = isImage ? "images" : "documents";
        const safeName = compressed.file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `projects/${project.id}/${folder}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await client.storage.from("private-project-files").upload(path, compressed.file, { contentType: compressed.file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: metadataError } = await client.from("project_files").insert({
          project_id: project.id,
          file_name: compressed.file.name,
          original_file_name: file.name,
          storage_bucket: "private-project-files",
          storage_path: path,
          file_type: isImage ? "image" : "document",
          mime_type: compressed.file.type,
          file_size_bytes: compressed.compressedSize,
          original_size_bytes: compressed.originalSize,
          compressed_size_bytes: compressed.compressedSize,
          is_image: isImage,
          is_cover: isImage && !state.files.some((item) => item.project_id === project.id && item.is_cover),
          sort_order: state.files.filter((item) => item.project_id === project.id).length + index,
          is_private: true
        });
        if (metadataError) {
          await client.storage.from("private-project-files").remove([path]);
          throw metadataError;
        }
        bar.style.width = `${Math.round(((index + 1) / files.length) * 100)}%`;
        toast(`${file.name}: ${formatBytes(file.size)} → ${formatBytes(compressed.compressedSize)}`);
      }
      await loadAll();
      await renderProjectDetail(project.id);
    } catch (error) {
      fail(error, "Upload nije uspio.");
    } finally {
      progress.hidden = true;
      bar.style.width = "0";
    }
  }

  async function compressImage(file, options = {}) {
    const maxWidth = options.maxWidth || 2000;
    const quality = options.quality || 0.75;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    const type = supportsWebp ? "image/webp" : "image/jpeg";
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Kompresija slike nije uspjela.")), type, quality));
    bitmap.close?.();
    const extension = supportsWebp ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return { file: new File([blob], `${baseName}.${extension}`, { type }), originalSize: file.size, compressedSize: blob.size };
  }

  async function uploadWebsiteImage(file, slug, folder) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error(`${file.name}: dopuštene su JPG, PNG i WebP fotografije.`);
    }
    const compressed = await compressImage(file, { maxWidth: 2000, quality: 0.78 });
    const safeSlug = slug.replace(/[^a-z0-9-]/g, "-");
    const safeName = compressed.file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `projects/${safeSlug}/${folder}/${Date.now()}-${safeName}`;
    const { error } = await client.storage
      .from("public-website-images")
      .upload(path, compressed.file, { contentType: compressed.file.type, upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("public-website-images").getPublicUrl(path);
    toast(`${file.name}: spremljeno ${formatBytes(file.size)} → ${formatBytes(compressed.compressedSize)}`);
    return data.publicUrl;
  }

  async function removeWebsiteStorageFiles(urls) {
    const marker = "/storage/v1/object/public/public-website-images/";
    const paths = urls
      .filter((url) => url.includes(marker))
      .map((url) => decodeURIComponent(url.split(marker)[1]));
    if (!paths.length) return;
    const { error } = await client.storage.from("public-website-images").remove(paths);
    if (error) console.warn("Neke uklonjene slike nisu obrisane iz Storagea.", error);
  }

  async function openPrivateFile(id) {
    const item = state.files.find((file) => file.id === id);
    if (!item) return;
    const previewTab = window.open("", "_blank");
    if (!previewTab) {
      toast("Safari je blokirao novi prozor. Dopusti pop-up prozore za ovu stranicu i pokušaj ponovno.", "error");
      return;
    }
    previewTab.opener = null;
    previewTab.document.title = "Učitavanje datoteke…";
    previewTab.document.body.innerHTML = '<p style="font:16px system-ui;padding:32px">Učitavanje privatne datoteke…</p>';
    try {
      const { data, error } = await client.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 120, { download: false });
      if (error) throw error;
      previewTab.location.replace(data.signedUrl);
    } catch (error) {
      previewTab.close();
      fail(error, "Datoteku nije moguće otvoriti.");
    }
  }

  async function deleteFile(id) {
    const item = state.files.find((file) => file.id === id);
    if (!item || !confirm(`Obrisati datoteku "${item.original_file_name || item.file_name}"?`)) return;
    try {
      const { error: storageError } = await client.storage.from(item.storage_bucket).remove([item.storage_path]);
      if (storageError) throw storageError;
      const { error } = await client.from("project_files").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
      toast("Datoteka je obrisana.");
      renderRoute();
    } catch (error) {
      fail(error);
    }
  }

  async function setCover(id) {
    const item = state.files.find((file) => file.id === id);
    if (!item) return;
    try {
      await client.from("project_files").update({ is_cover: false }).eq("project_id", item.project_id);
      const { error } = await client.from("project_files").update({ is_cover: true }).eq("id", id);
      if (error) throw error;
      await loadAll();
      toast("Glavna fotografija projekta je promijenjena. Ona ostaje privatna i ne objavljuje se automatski na web stranici.");
      renderRoute();
    } catch (error) {
      fail(error);
    }
  }

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Ovaj preglednik ne podržava push obavijesti.");
      if (!config.vapidPublicKey) throw new Error("VAPID public key nije postavljen na Vercelu.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Dozvola za obavijesti nije odobrena. In-app podsjetnici ostaju aktivni.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(subscription)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Push pretplata nije spremljena.");
      toast("Push obavijesti su uključene.");
    } catch (error) {
      fail(error);
    }
  }

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }

  function startInAppReminders() {
    const notified = new Set(JSON.parse(sessionStorage.getItem("glavaskop_notified_events") || "[]"));
    const check = () => {
      const now = Date.now();
      state.events.forEach((event) => {
        if (!event.reminder_enabled || event.status !== "planned" || notified.has(event.id)) return;
        const remindAt = new Date(event.start_time).getTime() - Number(event.reminder_minutes || 15) * 60000;
        if (now >= remindAt && now <= new Date(event.start_time).getTime() + 5 * 60000) {
          const message = `${event.title} · ${dateTimeFormatter.format(new Date(event.start_time))}`;
          toast(message);
          if (Notification.permission === "granted") new Notification("GLAVASKOP podsjetnik", { body: message });
          notified.add(event.id);
          sessionStorage.setItem("glavaskop_notified_events", JSON.stringify([...notified]));
        }
      });
    };
    check();
    setInterval(check, 60000);
  }

  async function renderRoute() {
    setActiveRoute();
    const path = location.pathname.replace(/\/+$/, "") || "/admin/web";
    if (path === "/admin" || path.startsWith("/admin/web")) setAdminSection("Upravljanje web stranicom");
    else setAdminSection("Organizer");
    if (path === "/admin" || path === "/admin/web") return renderWebsiteDashboard();
    if (path.startsWith("/admin/web/projekti")) return renderWebsiteProjects();
    if (path.startsWith("/admin/web/recenzije")) return renderWebsiteReviews();
    if (path.startsWith("/admin/web/sadrzaj")) return renderWebsiteContent();
    if (path === "/admin/organizer/mitarbeiter/new") {
      renderEmployees();
      employeeModal();
      return;
    }
    const employeeEditMatch = path.match(/^\/admin\/organizer\/mitarbeiter\/([0-9a-f-]+)\/edit$/i);
    if (employeeEditMatch) {
      renderEmployees();
      employeeModal(getEmployee(employeeEditMatch[1]));
      return;
    }
    if (path === "/admin/organizer/projekte/new") {
      renderProjects();
      projectModal();
      return;
    }
    const projectEditMatch = path.match(/^\/admin\/organizer\/projekte\/([0-9a-f-]+)\/edit$/i);
    if (projectEditMatch) {
      await renderProjectDetail(projectEditMatch[1]);
      projectModal(getProject(projectEditMatch[1]));
      return;
    }
    const detailMatch = path.match(/^\/admin\/organizer\/projekte\/([0-9a-f-]+)$/i);
    if (detailMatch) return renderProjectDetail(detailMatch[1]);
    if (path.startsWith("/admin/organizer/kalendar")) return renderCalendar();
    if (path.startsWith("/admin/organizer/mitarbeiter")) return renderEmployees();
    if (path.startsWith("/admin/organizer/projekte")) return renderProjects();
    if (path.startsWith("/admin/organizer/isplate")) return renderPayments();
    if (path.startsWith("/admin/organizer/nacrti")) return renderFiles();
    if (path.startsWith("/admin/organizer/troskovi")) return renderExpenses();
    return renderDashboard();
  }

  document.addEventListener("click", async (event) => {
    const route = event.target.closest("[data-route]");
    if (route) {
      event.preventDefault();
      navigate(route.getAttribute("href"));
      return;
    }
    if (event.target.closest("[data-close-modal]")) {
      closeModal();
      leaveFormRoute();
      return renderRoute();
    }
    if (event.target.closest('[data-action="new-website-project"]')) return websiteProjectModal();
    if (event.target.closest('[data-action="new-employee"]')) return navigate("/admin/organizer/mitarbeiter/new");
    if (event.target.closest('[data-action="new-project"]')) return navigate("/admin/organizer/projekte/new");
    if (event.target.closest('[data-action="new-payment"]')) return paymentModal();
    if (event.target.closest('[data-action="new-expense"]')) return expenseModal();
    if (event.target.closest('[data-action="new-event"]')) return eventModal();
    if (event.target.closest('[data-action="back-projects"]')) return navigate("/admin/organizer/projekte");

    const editEmployee = event.target.closest("[data-edit-employee]");
    if (editEmployee) return navigate(`/admin/organizer/mitarbeiter/${editEmployee.dataset.editEmployee}/edit`);
    const toggleEmployee = event.target.closest("[data-toggle-employee]");
    if (toggleEmployee) {
      const employee = getEmployee(toggleEmployee.dataset.toggleEmployee);
      const { error } = await client.from("employees").update({ active: !employee.active }).eq("id", employee.id);
      if (error) return fail(error);
      await loadAll(); renderEmployees(); toast("Status radnika je ažuriran."); return;
    }
    const deleteEmployee = event.target.closest("[data-delete-employee]");
    if (deleteEmployee) return removeRecord("employees", deleteEmployee.dataset.deleteEmployee, "radnika");

    const editWebsiteProject = event.target.closest("[data-edit-website-project]");
    if (editWebsiteProject) {
      return websiteProjectModal(state.websiteProjects.find((item) => item.id === Number(editWebsiteProject.dataset.editWebsiteProject)));
    }
    const deleteWebsiteProject = event.target.closest("[data-delete-website-project]");
    if (deleteWebsiteProject) {
      return removeRecord("website_projects", Number(deleteWebsiteProject.dataset.deleteWebsiteProject), "web projekt");
    }

    const viewProject = event.target.closest("[data-view-project]");
    if (viewProject) return navigate(`/admin/organizer/projekte/${viewProject.dataset.viewProject}`);
    const editProject = event.target.closest("[data-edit-project]");
    if (editProject) return navigate(`/admin/organizer/projekte/${editProject.dataset.editProject}/edit`);
    const deleteProject = event.target.closest("[data-delete-project]");
    if (deleteProject) return removeRecord("internal_projects", deleteProject.dataset.deleteProject, "interni projekt");
    const addWorker = event.target.closest("[data-add-worker]");
    if (addWorker) return workerModal(addWorker.dataset.addWorker);
    const removeWorker = event.target.closest("[data-remove-worker]");
    if (removeWorker) return removeRecord("project_workers", removeWorker.dataset.removeWorker, "povezanog radnika");

    const editPayment = event.target.closest("[data-edit-payment]");
    if (editPayment) return paymentModal(state.payments.find((item) => item.id === editPayment.dataset.editPayment));
    const deletePayment = event.target.closest("[data-delete-payment]");
    if (deletePayment) return removeRecord("employee_payments", deletePayment.dataset.deletePayment, "isplatu");
    const editExpense = event.target.closest("[data-edit-expense]");
    if (editExpense) return expenseModal(state.expenses.find((item) => item.id === editExpense.dataset.editExpense));
    const deleteExpense = event.target.closest("[data-delete-expense]");
    if (deleteExpense) return removeRecord("expenses", deleteExpense.dataset.deleteExpense, "trošak");

    const openFile = event.target.closest("[data-open-file]");
    if (openFile) return openPrivateFile(openFile.dataset.openFile);
    const coverFile = event.target.closest("[data-cover-file]");
    if (coverFile) return setCover(coverFile.dataset.coverFile);
    const deleteFileButton = event.target.closest("[data-delete-file]");
    if (deleteFileButton) return deleteFile(deleteFileButton.dataset.deleteFile);

    const editEvent = event.target.closest("[data-edit-event]");
    if (editEvent) return eventModal(state.events.find((item) => item.id === editEvent.dataset.editEvent));
    const newEventDate = event.target.closest("[data-new-event-date]");
    if (newEventDate) return eventModal(null, newEventDate.dataset.newEventDate);
    const calendarNav = event.target.closest("[data-calendar-nav]");
    if (calendarNav) {
      const direction = Number(calendarNav.dataset.calendarNav);
      if (calendarView === "month") calendarCursor.setMonth(calendarCursor.getMonth() + direction);
      else if (calendarView === "week") calendarCursor.setDate(calendarCursor.getDate() + direction * 7);
      else calendarCursor.setDate(calendarCursor.getDate() + direction);
      return renderCalendar();
    }
    if (event.target.closest("[data-calendar-today]")) { calendarCursor = new Date(); return renderCalendar(); }
    const view = event.target.closest("[data-calendar-view]");
    if (view) { calendarView = view.dataset.calendarView; return renderCalendar(); }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "website-project-search") drawWebsiteProjectRows();
    if (event.target.id === "employee-search") drawEmployeeRows();
    if (event.target.id === "project-search") drawProjectRows();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "website-project-category") drawWebsiteProjectRows();
    if (event.target.id === "employee-status") drawEmployeeRows();
    if (event.target.id === "project-status") drawProjectRows();
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "website-content-form") return;
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Spremanje…";
    try {
      await saveWebsiteContent(event.target);
      toast("Podaci firme su spremljeni i dostupni javnoj stranici.");
      renderWebsiteContent();
    } catch (error) {
      fail(error, "Podatke firme nije moguće spremiti.");
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  modalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!modalSubmit) return;
    const button = modalForm.querySelector('button[type="submit"]');
    button.disabled = true;
    modalError.textContent = "";
    try {
      await modalSubmit(new FormData(modalForm));
      closeModal();
      leaveFormRoute();
      await loadAll();
      toast("Promjene su spremljene.");
      renderRoute();
    } catch (error) {
      console.error(error);
      modalError.textContent = error.message || "Spremanje nije uspjelo.";
    } finally {
      button.disabled = false;
    }
  });

  window.addEventListener("popstate", renderRoute);
  document.getElementById("admin-menu-toggle").addEventListener("click", () => document.getElementById("organizer-sidebar").classList.toggle("open"));
  const handbookDialog = document.getElementById("handbook-dialog");
  document.getElementById("open-handbook").addEventListener("click", () => handbookDialog.showModal());
  document.getElementById("close-handbook").addEventListener("click", () => handbookDialog.close());
  document.getElementById("handbook-done").addEventListener("click", () => handbookDialog.close());
  handbookDialog.addEventListener("click", (event) => {
    if (event.target === handbookDialog) handbookDialog.close();
  });
  document.getElementById("push-toggle").addEventListener("click", enablePush);
  document.getElementById("change-password").addEventListener("click", passwordModal);
  document.getElementById("modal-delete").addEventListener("click", async () => {
    if (!modalDelete) return;
    try {
      const deleted = await modalDelete();
      if (!deleted) return;
      closeModal();
      await loadAll();
      toast("Termin je obrisan.");
      renderRoute();
    } catch (error) {
      modalError.textContent = error.message || "Brisanje nije uspjelo.";
    }
  });
  document.getElementById("admin-logout").addEventListener("click", async () => {
    await client.auth.signOut();
    location.replace("/admin/login");
  });

  try {
    const configResponse = await fetch("/api/config");
    config = await configResponse.json();
    if (!configResponse.ok) throw new Error(config.error || "Supabase konfiguracija nije dostupna.");
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await client.auth.getSession();
    session = data.session;
    if (!session) {
      location.replace("/admin/login");
      return;
    }
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", session.user.id).single();
    if (profileError || !["owner", "admin"].includes(profile?.role)) {
      await client.auth.signOut();
      throw new Error("Ovaj račun nema owner/admin ovlasti za Organizer.");
    }
    document.getElementById("admin-user").textContent = session.user.email;
    await loadAll();
    await renderRoute();
    startInAppReminders();
  } catch (error) {
    app.innerHTML = pageHead("KONFIGURACIJA", "Organizer nije dostupan", error.message) +
      '<section class="org-card"><p>Provjerite Supabase environment varijable, migraciju i owner profil prema uputama u README-u.</p><a class="button button-dark" href="/admin/login">Povratak na prijavu</a></section>';
  }
})();
