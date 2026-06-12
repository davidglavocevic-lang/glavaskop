(function () {
  "use strict";

  const company = window.COMPANY_DATA || {};
  const projects = window.PROJECTS_DATA || [];
  const reviews = window.REVIEWS_DATA || [];
  const page = document.body.dataset.page || "";

  const escapeHTML = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function hydrateCompanyData() {
    document.querySelectorAll("[data-company]").forEach((element) => {
      const key = element.dataset.company;
      if (company[key] !== undefined) element.textContent = company[key];
    });

    document.querySelectorAll("[data-phone-link]").forEach((link) => {
      link.href = `tel:${company.phoneHref}`;
    });
    document.querySelectorAll("[data-email-link]").forEach((link) => {
      link.href = `mailto:${company.email}`;
    });
  }

  function headerTemplate() {
    const currentFile = location.pathname.split("/").pop() || "index.html";
    const nav = (company.navigation || [])
      .map((item) => {
        const itemFile = item.href.split("#")[0];
        const isActive =
          currentFile === itemFile ||
          (currentFile === "project-detail.html" && itemFile === "projects.html");
        return `<a class="${isActive ? "active" : ""}" href="${escapeHTML(item.href)}">${escapeHTML(item.label)}</a>`;
      })
      .join("");

    return `
      <header class="site-header" id="site-header-inner">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="GLAVAŠ KOP početna">
            <span class="brand-mark">${escapeHTML(company.shortName)}</span>
            <span><strong>GLAVAŠ</strong><small>KOP</small></span>
          </a>
          <button class="menu-toggle" id="menu-toggle" aria-label="Otvori navigaciju" aria-expanded="false">☰</button>
          <nav class="site-nav" id="site-nav" aria-label="Glavna navigacija">
            ${nav}
            <a class="header-cta" href="contact.html">Zatraži ponudu</a>
          </nav>
        </div>
      </header>`;
  }

  function footerTemplate() {
    const links = (company.navigation || [])
      .map((item) => `<a href="${escapeHTML(item.href)}">${escapeHTML(item.label)}</a>`)
      .join("");
    const year = new Date().getFullYear();

    return `
      <footer class="site-footer">
        <div class="container footer-main">
          <div class="footer-brand">
            <a class="brand light-brand" href="index.html">
              <span class="brand-mark">${escapeHTML(company.shortName)}</span>
              <span><strong>GLAVAŠ</strong><small>KOP</small></span>
            </a>
            <p>${escapeHTML(company.slogan)} Iskopi, rušenja i uređenje terena uz odgovoran pristup svakom projektu.</p>
            <a class="footer-phone" href="tel:${escapeHTML(company.phoneHref)}">${escapeHTML(company.phone)}</a>
          </div>
          <div class="footer-col">
            <h3>NAVIGACIJA</h3>
            ${links}
          </div>
          <div class="footer-col">
            <h3>KONTAKT</h3>
            <a href="mailto:${escapeHTML(company.email)}">${escapeHTML(company.email)}</a>
            <a href="tel:${escapeHTML(company.phoneHref)}">${escapeHTML(company.phone)}</a>
            <span>${escapeHTML(company.serviceArea)}</span>
            <span>${escapeHTML(company.workingHours)}</span>
          </div>
        </div>
        <div class="container footer-bottom">
          <span>© ${year} ${escapeHTML(company.name)}. Sva prava pridržana.</span>
          <a href="admin-login.html">Vlasnički pristup</a>
        </div>
      </footer>`;
  }

  function renderSharedLayout() {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) header.innerHTML = headerTemplate();
    if (footer) footer.innerHTML = footerTemplate();

    const headerElement = document.getElementById("site-header-inner");
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("site-nav");

    const setHeaderState = () => {
      if (headerElement) headerElement.classList.toggle("scrolled", window.scrollY > 24);
    };
    setHeaderState();
    window.addEventListener("scroll", setHeaderState, { passive: true });

    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("open");
        document.body.classList.toggle("menu-open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "×" : "☰";
      });
      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          nav.classList.remove("open");
          document.body.classList.remove("menu-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.textContent = "☰";
        });
      });
    }
  }

  function serviceCard(service) {
    return `
      <article class="service-card reveal">
        <div class="service-top"><span>${escapeHTML(service.number)}</span><span class="service-icon" aria-hidden="true">${escapeHTML(service.icon)}</span></div>
        <h3>${escapeHTML(service.title)}</h3>
        <p>${escapeHTML(service.text)}</p>
      </article>`;
  }

  function projectCard(project) {
    const url = `project-detail.html?project=${encodeURIComponent(project.slug)}`;
    return `
      <article class="project-card reveal" data-category="${escapeHTML(project.category)}">
        <a class="project-image" href="${url}" aria-label="Otvori projekt ${escapeHTML(project.title)}">
          <img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)}" loading="lazy">
        </a>
        <div class="project-meta"><span>${escapeHTML(project.category)}</span><span>${escapeHTML(project.location)}</span></div>
        <h3><a href="${url}">${escapeHTML(project.title)}</a></h3>
        <p>${escapeHTML(project.excerpt)}</p>
      </article>`;
  }

  function reviewCard(review) {
    const initial = review.name.trim().charAt(0);
    return `
      <article class="review-card reveal">
        <div class="review-stars" aria-label="${review.rating} od 5 zvjezdica">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        <blockquote>“${escapeHTML(review.text)}”</blockquote>
        <div class="review-author">
          <span class="review-avatar" aria-hidden="true">${escapeHTML(initial)}</span>
          <span><strong>${escapeHTML(review.name)}</strong><small>${escapeHTML(review.source)}</small></span>
          <span class="demo-label">DEMO</span>
        </div>
      </article>`;
  }

  function renderHome() {
    const servicesGrid = document.getElementById("services-grid");
    const advantagesGrid = document.getElementById("advantages-grid");
    const equipmentGrid = document.getElementById("equipment-grid");
    const projectsGrid = document.getElementById("featured-projects");
    const processList = document.getElementById("process-list");
    const reviewsGrid = document.getElementById("reviews-grid");

    if (servicesGrid) servicesGrid.innerHTML = company.services.map(serviceCard).join("");
    if (advantagesGrid) {
      advantagesGrid.innerHTML = company.advantages
        .map((item) => `<article class="advantage reveal"><span>${escapeHTML(item.value)}</span><p>${escapeHTML(item.label)}</p></article>`)
        .join("");
    }
    if (equipmentGrid) {
      equipmentGrid.innerHTML = company.equipment
        .map(
          (item) => `
            <article class="equipment-card reveal">
              <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)} na radnom terenu" loading="lazy">
              <div class="equipment-overlay"><span>${escapeHTML(item.tag)}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p></div>
            </article>`
        )
        .join("");
    }
    if (projectsGrid) projectsGrid.innerHTML = projects.filter((item) => item.featured).slice(0, 3).map(projectCard).join("");
    if (processList) {
      processList.innerHTML = company.process
        .map(
          (item) => `<article class="process-step reveal"><span>${escapeHTML(item.step)}</span><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p></div></article>`
        )
        .join("");
    }
    if (reviewsGrid) reviewsGrid.innerHTML = reviews.slice(0, 5).map(reviewCard).join("");

    const average = reviews.length
      ? reviews.reduce((total, item) => total + item.rating, 0) / reviews.length
      : 0;
    const averageNode = document.getElementById("average-rating");
    if (averageNode) averageNode.textContent = average.toFixed(1);
  }

  function renderProjects() {
    const grid = document.getElementById("all-projects");
    const filters = document.getElementById("project-filters");
    const empty = document.getElementById("projects-empty");
    if (!grid || !filters) return;

    const categories = ["Svi", ...new Set(projects.map((item) => item.category))];
    filters.innerHTML = categories
      .map((category, index) => `<button class="filter-button ${index === 0 ? "active" : ""}" type="button" data-filter="${escapeHTML(category)}">${escapeHTML(category)}</button>`)
      .join("");

    const showProjects = (category) => {
      const filtered = category === "Svi" ? projects : projects.filter((item) => item.category === category);
      grid.innerHTML = filtered.map(projectCard).join("");
      if (empty) empty.hidden = filtered.length > 0;
      initReveal();
    };

    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      filters.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      showProjects(button.dataset.filter);
    });

    showProjects("Svi");
  }

  function renderProjectDetail() {
    const target = document.getElementById("project-detail");
    if (!target) return;
    const slug = new URLSearchParams(location.search).get("project");
    const project = projects.find((item) => item.slug === slug) || projects[0];
    if (!project) {
      target.innerHTML = `<section class="section"><div class="container"><h1>Projekt nije pronađen.</h1><a href="projects.html">Povratak na projekte</a></div></section>`;
      return;
    }

    document.title = `${project.title} | ${company.name}`;
    target.innerHTML = `
      <section class="project-detail-hero">
        <div class="container">
          <a class="project-back" href="projects.html">← Svi projekti</a>
          <div class="project-detail-heading">
            <div><p class="eyebrow dark">${escapeHTML(project.category)}</p><h1>${escapeHTML(project.title)}</h1></div>
            <div class="project-facts">
              <div><small>LOKACIJA</small><strong>${escapeHTML(project.location)}</strong></div>
              <div><small>STATUS</small><strong>${escapeHTML(project.status)}</strong></div>
              <div><small>GODINA</small><strong>${escapeHTML(project.date)}</strong></div>
              <div><small>MEHANIZACIJA</small><strong>${escapeHTML(project.equipment[0])}</strong></div>
            </div>
          </div>
        </div>
      </section>
      <img class="project-main-image" src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)}">
      <section class="section section-light">
        <div class="container project-story">
          <div><p class="eyebrow dark">O PROJEKTU</p><h2>Od zahtjeva do uredne izvedbe.</h2></div>
          <div class="project-story-copy">
            <p>${escapeHTML(project.description)}</p>
            <div class="spec-list">
              ${project.specs.map((spec, index) => `<div><span>0${index + 1}</span><strong>${escapeHTML(spec)}</strong></div>`).join("")}
            </div>
          </div>
        </div>
      </section>
      <section class="section section-dark">
        <div class="container">
          <div class="section-heading"><p class="eyebrow">GALERIJA</p><h2>Detalji s terena.</h2></div>
          <div class="project-gallery">
            ${project.gallery.map((image, index) => `<img src="${escapeHTML(image)}" alt="${escapeHTML(project.title)} - prikaz ${index + 1}" loading="lazy">`).join("")}
          </div>
        </div>
      </section>
      <section class="cta-section"><div class="container cta-grid"><div><p class="eyebrow dark">SLIČAN PROJEKT?</p><h2>Razgovarajmo o vašem terenu.</h2></div><div><p>Pošaljite lokaciju, opis i fotografije za prvi razgovor o izvedbi.</p><a class="button button-dark" href="contact.html">Pošaljite upit <span>↗</span></a></div></div></section>`;
  }

  function setupContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let valid = true;
      const required = form.querySelectorAll("[required]");

      form.querySelectorAll(".field-error").forEach((node) => (node.textContent = ""));
      form.querySelectorAll(".invalid").forEach((node) => node.classList.remove("invalid"));

      required.forEach((field) => {
        if (!field.value.trim()) {
          valid = false;
          field.classList.add("invalid");
          const error = field.parentElement.querySelector(".field-error");
          if (error) error.textContent = "Ovo polje je obavezno.";
        }
      });

      const email = form.elements.email;
      if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        valid = false;
        email.classList.add("invalid");
        email.parentElement.querySelector(".field-error").textContent = "Unesite ispravnu e-mail adresu.";
      }
      if (!valid) {
        form.querySelector(".invalid")?.focus();
        return;
      }

      const data = new FormData(form);
      const subject = `Upit za radove - ${data.get("location")}`;
      const body = [
        `Ime i prezime: ${data.get("name")}`,
        `Telefon: ${data.get("phone")}`,
        `E-mail: ${data.get("email") || "-"}`,
        `Lokacija: ${data.get("location")}`,
        `Vrsta radova: ${data.get("service")}`,
        "",
        "Opis projekta:",
        data.get("message")
      ].join("\n");

      const success = document.getElementById("form-success");
      if (success) success.hidden = false;
      location.href = `mailto:${company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  function initReveal() {
    const elements = document.querySelectorAll(".reveal:not(.visible)");
    if (!elements.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            instance.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -35px" }
    );
    elements.forEach((element) => observer.observe(element));
  }

  renderSharedLayout();
  hydrateCompanyData();

  if (page === "home") renderHome();
  if (page === "projects") renderProjects();
  if (page === "project-detail") renderProjectDetail();
  if (page === "contact") setupContactForm();

  initReveal();
})();
