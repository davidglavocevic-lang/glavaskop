(function () {
  "use strict";

  const AUTH_KEY = "glavaskop_demo_admin";
  const PROJECTS_KEY = "glavaskop_demo_projects";
  const page = document.body.dataset.page;
  const baseProjects = window.PROJECTS_DATA || [];
  const reviews = window.REVIEWS_DATA || [];
  const company = window.COMPANY_DATA || {};

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === "true";
  }

  function getProjects() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROJECTS_KEY));
      return Array.isArray(saved) ? saved : [...baseProjects];
    } catch {
      return [...baseProjects];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function setupLogin() {
    if (isAuthenticated()) {
      location.replace("admin.html");
      return;
    }
    const form = document.getElementById("admin-login-form");
    const error = document.getElementById("login-error");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      if (data.get("username") === "demo" && data.get("password") === "demo") {
        sessionStorage.setItem(AUTH_KEY, "true");
        location.replace("admin.html");
      } else {
        error.textContent = "Pogrešni demo podaci. Upišite demo / demo.";
      }
    });
  }

  function setupAdmin() {
    if (!isAuthenticated()) {
      location.replace("admin-login.html");
      return;
    }

    let projects = getProjects();
    const sidebar = document.querySelector(".admin-sidebar");
    const modal = document.getElementById("project-modal");
    const projectForm = document.getElementById("project-form");
    const modalTitle = document.getElementById("project-modal-title");
    const search = document.getElementById("admin-project-search");

    function switchView(view) {
      document.querySelectorAll(".admin-view").forEach((section) => section.classList.remove("active"));
      document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("active", button.dataset.adminView === view));
      document.getElementById(`admin-${view}`)?.classList.add("active");
      sidebar?.classList.remove("open");
    }

    function renderStats() {
      const stats = [
        [projects.length, "Ukupno projekata"],
        [projects.filter((item) => item.featured).length, "Istaknuti projekti"],
        [reviews.length, "Demo recenzije"],
        [company.services?.length || 0, "Aktivne usluge"]
      ];
      document.getElementById("admin-stats").innerHTML = stats
        .map(([value, label]) => `<article class="admin-stat"><strong>${value}</strong><span>${label}</span></article>`)
        .join("");
    }

    function renderRecent() {
      document.getElementById("admin-recent-projects").innerHTML = projects
        .slice(0, 4)
        .map(
          (project) => `<article class="recent-project"><img src="${project.image}" alt=""><span><strong>${project.title}</strong><small>${project.location}</small></span><span>${project.status}</span></article>`
        )
        .join("");
    }

    function renderProjectRows(query = "") {
      const normalized = query.toLowerCase().trim();
      const filtered = projects.filter((project) =>
        [project.title, project.category, project.location].some((value) => String(value).toLowerCase().includes(normalized))
      );
      document.getElementById("admin-project-rows").innerHTML = filtered
        .map(
          (project) => `
            <tr>
              <td><div class="table-project"><img src="${project.image}" alt=""><strong>${project.title}</strong></div></td>
              <td>${project.category}</td><td>${project.location}</td><td><span class="status-pill">${project.status}</span></td>
              <td><button class="table-action" data-edit="${project.id}">Uredi</button> <button class="table-action delete" data-delete="${project.id}">Briši</button></td>
            </tr>`
        )
        .join("");
    }

    function renderReviews() {
      document.getElementById("admin-review-list").innerHTML = reviews
        .map(
          (review) => `<article class="admin-review"><div class="admin-review-head"><strong>${review.name}</strong><span class="review-stars">${"★".repeat(review.rating)}</span></div><p>${review.text}</p><small>${review.source} · DEMO</small></article>`
        )
        .join("");
    }

    function renderCompanyPreview() {
      const values = [
        ["Naziv", company.name],
        ["Telefon", company.phone],
        ["E-mail", company.email],
        ["Područje rada", company.serviceArea],
        ["Radno vrijeme", company.workingHours],
        ["Adresa", company.address]
      ];
      document.getElementById("company-data-preview").innerHTML = values
        .map(([label, value]) => `<div class="company-preview-row"><span>${label}</span><strong>${value}</strong></div>`)
        .join("");
    }

    function openProjectModal(project) {
      projectForm.reset();
      projectForm.elements.id.value = project?.id || "";
      projectForm.elements.title.value = project?.title || "";
      projectForm.elements.category.value = project?.category || "Iskopi";
      projectForm.elements.location.value = project?.location || "";
      projectForm.elements.excerpt.value = project?.excerpt || "";
      modalTitle.textContent = project ? "Uredi projekt" : "Novi projekt";
      modal.showModal();
    }

    document.querySelectorAll("[data-admin-view]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.adminView));
    });
    document.querySelectorAll("[data-go-view]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.goView));
    });
    document.getElementById("admin-menu-toggle")?.addEventListener("click", () => sidebar?.classList.toggle("open"));
    document.getElementById("admin-logout")?.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEY);
      location.replace("admin-login.html");
    });
    document.getElementById("add-project")?.addEventListener("click", () => openProjectModal());
    document.getElementById("project-modal-close")?.addEventListener("click", () => modal.close());
    document.getElementById("project-modal-cancel")?.addEventListener("click", () => modal.close());
    search?.addEventListener("input", () => renderProjectRows(search.value));

    document.getElementById("admin-project-rows")?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");
      if (editButton) {
        const project = projects.find((item) => item.id === Number(editButton.dataset.edit));
        if (project) openProjectModal(project);
      }
      if (deleteButton) {
        const id = Number(deleteButton.dataset.delete);
        const project = projects.find((item) => item.id === id);
        if (project && confirm(`Obrisati projekt "${project.title}" iz demo pohrane?`)) {
          projects = projects.filter((item) => item.id !== id);
          saveProjects(projects);
          renderAll();
        }
      }
    });

    projectForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(projectForm);
      const id = Number(data.get("id"));
      const existing = projects.find((item) => item.id === id);
      const payload = {
        ...(existing || {}),
        id: existing?.id || Date.now(),
        slug: existing?.slug || String(data.get("title")).toLowerCase().replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title: data.get("title"),
        category: data.get("category"),
        location: data.get("location"),
        excerpt: data.get("excerpt"),
        description: existing?.description || data.get("excerpt"),
        image: existing?.image || "images/hero.jpeg",
        gallery: existing?.gallery || ["images/hero.jpeg", "images/g1.jpeg", "images/g2.jpeg"],
        date: existing?.date || String(new Date().getFullYear()),
        status: existing?.status || "Dovršeno",
        equipment: existing?.equipment || ["Mini bager"],
        specs: existing?.specs || ["Priprema", "Izvedba", "Završno uređenje"],
        featured: existing?.featured || false
      };
      projects = existing ? projects.map((item) => (item.id === id ? payload : item)) : [payload, ...projects];
      saveProjects(projects);
      modal.close();
      renderAll();
    });

    function renderAll() {
      renderStats();
      renderRecent();
      renderProjectRows(search?.value || "");
      renderReviews();
      renderCompanyPreview();
    }

    renderAll();
  }

  if (page === "admin-login") setupLogin();
  if (page === "admin") setupAdmin();
})();
