(() => {
  "use strict";

  // -------------------------------
  // Helpers
  // -------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const state = {
    data: null,     // normalized data
    flat: [],
    filters: { category: "", license: "", language: "", has: "" },
    sort: "az",
    focus: false,
    compact: false,
    lastQuery: "",
    activeSection: "",
  };

  const els = {
    q: $("#q"),
    content: $("#content"),
    toc: $("#toc"),
    portals: $("#portals"),
    controls: $("#controls"),
    resultCount: $("#resultCount"),
    loadHint: $("#loadHint"),
    statCats: $("#statCats"),
    statItems: $("#statItems"),
    statTags: $("#statTags"),
    aboutLinks: $("#aboutLinks"),
    siteTitle: $("#siteTitle"),

    btnMenu: $("#btnMenu"),
    btnTheme: $("#btnTheme"),
    btnFocus: $("#btnFocus"),
    btnCompact: $("#btnCompact"),
    btnSearch: $("#btnSearch"),
    btnSurprise: $("#btnSurprise"),
    btnTop: $("#btnTop"),
    progress: $("#progress"),
    toast: $("#toast"),

    drawer: $("#drawer"),
    drawerBackdrop: $("#drawerBackdrop"),
    btnCloseDrawer: $("#btnCloseDrawer"),
    drawerToc: $("#drawerToc"),
    drawerControls: $("#drawerControls"),

    paletteBackdrop: $("#paletteBackdrop"),
    palette: $("#palette"),
    cmdQ: $("#cmdQ"),
    cmdList: $("#cmdList"),
  };

  function safeText(s) {
    if (s == null) return "";
    return String(s);
  }

  function escapeHTML(str) {
    return safeText(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#039;");
  }

  function toast(msg) {
    const t = els.toast;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._id);
    toast._id = setTimeout(() => (t.style.display = "none"), 1500);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // -------------------------------
  // Theme
  // -------------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // -------------------------------
  // Drawer
  // -------------------------------
  function openDrawer() {
    els.drawer.classList.add("open");
    els.drawerBackdrop.classList.add("show");
  }
  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.drawerBackdrop.classList.remove("show");
  }

  // -------------------------------
  // Palette
  // -------------------------------
  function openPalette() {
    els.paletteBackdrop.classList.add("show");
    els.palette.classList.add("show");
    els.cmdQ.value = "";
    renderCommands("");
    setTimeout(() => els.cmdQ.focus(), 0);
  }
  function closePalette() {
    els.paletteBackdrop.classList.remove("show");
    els.palette.classList.remove("show");
  }

  function renderCommands(query) {
    const q = safeText(query).trim().toLowerCase();
    const cmds = [];

    cmds.push({
      title: "Activer/Désactiver le mode focus",
      desc: "Masque la sidebar et agrandit la lecture",
      run() { toggleFocus(); closePalette(); },
    });
    cmds.push({
      title: "Activer/Désactiver le mode compact",
      desc: "Affiche plus de cartes à l’écran",
      run() { toggleCompact(); closePalette(); },
    });
    cmds.push({
      title: "Changer de thème",
      desc: "Dark ↔ Light",
      run() { toggleTheme(); closePalette(); },
    });
    cmds.push({
      title: "Surprends-moi",
      desc: "Saute vers un outil aléatoire",
      run() { surpriseMe(); closePalette(); },
    });

    if (state.data?.categories) {
      for (const cat of state.data.categories) {
        cmds.push({
          title: `Aller à : ${cat.title}`,
          desc: "Navigation directe à une catégorie",
          run() {
            const el = document.getElementById(cat.id);
            if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
            closePalette();
          },
        });
      }
    }

    const filtered = q ? cmds.filter(c => (c.title + " " + c.desc).toLowerCase().includes(q)) : cmds;

    els.cmdList.innerHTML = filtered.slice(0, 40).map((c, idx) => `
      <div class="cmd" data-idx="${idx}">
        <div class="left">
          <div class="t">${escapeHTML(c.title)}</div>
          <div class="d">${escapeHTML(c.desc)}</div>
        </div>
        <span class="badge-mini">↵</span>
      </div>
    `).join("");

    $$(".cmd", els.cmdList).forEach((row, i) => {
      row.addEventListener("click", () => { try { filtered[i].run(); } catch (e) { console.error(e); } });
    });

    els.cmdQ.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        if (filtered[0]) {
          try { filtered[0].run(); } catch (e) { console.error(e); }
        }
      }
    };
  }

  // -------------------------------
  // Data load (JSON first, MD fallback)
  // -------------------------------
  async function tryLoadJSON() {
    // Prefer ./data.json
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json non disponible");
    const json = await res.json();
    return normalizeDataFromJSON(json);
  }

  async function tryLoadMarkdownAndParse() {
    // fallback: try a few filenames
    const candidates = ["./awesome-sysadmin.md", "./README.md", "./readme.md"];
    let text = null;
    let used = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const t = await res.text();
        if (t && t.length > 100) { text = t; used = url; break; }
      } catch {}
    }
    if (!text) throw new Error("Impossible de charger le Markdown");
    const parsed = parseMarkdown(text);
    const normalized = normalizeDataFromParsed(parsed);
    normalized._source = used;
    return normalized;
  }

  function normalizeDataFromJSON(json) {
    // Expected schema from build_data.py:
    // { title, description, categories:[{id,title,subcategories:[{id,title,items:[{id,name,url,description_fr,description_en,links,licenses,langs}]}]}] }
    // We additionally normalize links into array and tags.
    const data = {
      title: safeText(json.title || "Awesome Sysadmin"),
      description: safeText(json.description || ""),
      categories: [],
      aboutLinks: Array.isArray(json.aboutLinks) ? json.aboutLinks : [],
    };

    const cats = Array.isArray(json.categories) ? json.categories : [];
    for (const cat of cats) {
      const catTitle = safeText(cat.title);
      const catId = safeText(cat.id) || slugify(catTitle);
      const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];

      const outCat = { title: catTitle, id: catId, subcategories: [] };

      for (const sub of subcats) {
        const subTitle = safeText(sub.title);
        const subId = safeText(sub.id) || slugify(catTitle + "-" + subTitle);
        const items = Array.isArray(sub.items) ? sub.items : [];

        const outSub = { title: subTitle, id: subId, items: [] };

        for (const it of items) {
          const name = safeText(it.name);
          const url = safeText(it.url);
          const id = safeText(it.id) || stableId(catTitle, subTitle, name, url);

          // links may be dict; keep demo/source etc
          const linksDict = it.links && typeof it.links === "object" ? it.links : {};
          const linksArr = [{ label: "Site", url }].concat(
            Object.entries(linksDict)
              .filter(([, u]) => !!u && safeText(u) !== url)
              .map(([k, u]) => ({ label: safeText(k), url: safeText(u) }))
          );

          const licenses = Array.isArray(it.licenses) ? it.licenses.map(safeText) : [];
          const langs = Array.isArray(it.langs) ? it.langs.map(safeText) : [];

          // For display: use FR if present else EN else fallback
          const descFR = safeText(it.description_fr || "");
          const descEN = safeText(it.description_en || "");
          const description = (descFR || descEN || "—").trim() || "—";

          const tags = dedupeArr([...licenses, ...langs]);

          outSub.items.push({
            id,
            name,
            url,
            description,
            description_fr: descFR,
            description_en: descEN,
            links: linksArr,
            licenses,
            langs,
            tags,
            category: catTitle,
            subcategory: subTitle,
          });
        }

        outCat.subcategories.push(outSub);
      }

      data.categories.push(outCat);
    }

    return data;
  }

  function normalizeDataFromParsed(parsed) {
    // Parsed schema from parseMarkdown() below: { title, description, categories, aboutLinks }
    // We keep EN descriptions in parsed; FR unavailable -> we display EN as fallback.
    const data = {
      title: safeText(parsed.title || "Awesome Sysadmin"),
      description: safeText(parsed.description || ""),
      categories: [],
      aboutLinks: Array.isArray(parsed.aboutLinks) ? parsed.aboutLinks : [],
    };

    for (const cat of (parsed.categories || [])) {
      const outCat = { title: cat.title, id: cat.id, subcategories: [] };
      for (const sub of (cat.subcategories || [])) {
        const outSub = { title: sub.title, id: sub.id, items: [] };
        for (const it of (sub.items || [])) {
          const tags = Array.isArray(it.tags) ? it.tags : [];
          const { licenses, langs } = splitLicensesLangs(tags);

          outSub.items.push({
            id: it.id || stableId(cat.title, sub.title, it.name, it.url),
            name: it.name,
            url: it.url,
            description: it.description || "—",
            description_fr: "",
            description_en: it.description || "",
            links: Array.isArray(it.links) ? it.links : [{ label: "Site", url: it.url }],
            licenses,
            langs,
            tags: dedupeArr([...licenses, ...langs]),
            category: cat.title,
            subcategory: sub.title,
          });
        }
        outCat.subcategories.push(outSub);
      }
      data.categories.push(outCat);
    }
    return data;
  }

  // -------------------------------
  // Markdown parsing (fallback)
  // -------------------------------
  function slugify(text) {
    const s = safeText(text)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "section";
  }

  function stableId(...parts) {
    // quick stable-ish id for client side
    const raw = parts.map(safeText).join("||");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (h << 5) - h + raw.charCodeAt(i), h |= 0;
    return ("id" + Math.abs(h)).slice(0, 12);
  }

  function parseMarkdown(md) {
    const lines = safeText(md).split(/\r?\n/);

    let title = "";
    let description = "";
    const categories = [];
    const aboutLinks = [];

    let currentCat = null;
    let currentSub = null;

    const usedIds = new Set();
    const uniqueId = (base) => {
      let id = slugify(base);
      if (!usedIds.has(id)) { usedIds.add(id); return id; }
      let i = 2;
      while (usedIds.has(id + "-" + i)) i++;
      id = id + "-" + i;
      usedIds.add(id);
      return id;
    };

    // Title
    for (const ln of lines) {
      const m = ln.match(/^#\s+(.+)\s*$/);
      if (m) { title = m[1].trim(); break; }
    }

    // Description
    let seenTitle = false;
    for (const ln of lines) {
      if (!seenTitle) { if (/^#\s+/.test(ln)) seenTitle = true; continue; }
      if (!ln.trim()) continue;
      if (/^\[!\[/.test(ln.trim())) continue; // badges
      description = ln.trim();
      break;
    }

    function ensureCat(t) {
      const cat = { title: t, id: uniqueId(t), subcategories: [] };
      categories.push(cat);
      return cat;
    }
    function ensureSub(cat, t) {
      const sub = { title: t, id: uniqueId(cat.title + "-" + t), items: [] };
      cat.subcategories.push(sub);
      return sub;
    }

    function harvestAbout(ln) {
      const re = /\[([^\]]+)\]\(([^)]+)\)/g;
      let m;
      while ((m = re.exec(ln)) !== null) {
        const text = m[1].trim();
        const url = m[2].trim();
        if (!url) continue;
        const k = (text + " " + url).toLowerCase();
        if (k.includes("contribut") || k.includes("issue") || k.includes("pull") || k.includes("donat") || k.includes("template")) {
          aboutLinks.push({ text, url });
        }
      }
    }

    for (const ln of lines) {
      harvestAbout(ln);

      let m = ln.match(/^##\s+(.+?)\s*$/);
      if (m) { currentCat = ensureCat(m[1].trim()); currentSub = null; continue; }

      m = ln.match(/^###\s+(.+?)\s*$/);
      if (m && currentCat) { currentSub = ensureSub(currentCat, m[1].trim()); continue; }

      if (!currentCat) continue;

      if (/^\s*[-*+]\s+/.test(ln)) {
        const main = ln.match(/^\s*[-*+]\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:[-–—:]\s*)?(.*)$/);
        if (!main) continue;

        const name = main[1].trim();
        const url = main[2].trim();

        // Skip TOC anchors or local links
        if (url.startsWith("#") || url.startsWith("./") || url.startsWith("/") || url.startsWith("mailto:")) continue;

        const rest = (main[3] || "").trim();

        const tags = [];
        const tagRe = /`([^`]+)`/g;
        let tm;
        while ((tm = tagRe.exec(rest)) !== null) tags.push(tm[1].trim());

        const links = [{ label: "Site", url }];
        const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lm;
        while ((lm = linkRe.exec(rest)) !== null) {
          const label = lm[1].trim();
          const lurl = lm[2].trim();
          if (lurl && lurl !== url) links.push({ label, url: lurl });
        }

        let desc = rest
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "")
          .replace(/`[^`]+`/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (!desc) desc = "—";

        const item = {
          id: uniqueId(`${currentCat.title}-${currentSub ? currentSub.title : "Général"}-${name}`),
          name,
          url,
          description: desc,
          links,
          tags,
        };

        if (!currentSub) currentSub = ensureSub(currentCat, "Général");
        currentSub.items.push(item);
      }
    }

    // Deduplicate about links
    const seen = new Set();
    const about = [];
    for (const l of aboutLinks) {
      if (!seen.has(l.url)) { about.push(l); seen.add(l.url); }
    }

    return { title, description, categories, aboutLinks: about };
  }

  // -------------------------------
  // Tags / filtering
  // -------------------------------
  function dedupeArr(xs) {
    const out = [];
    const seen = new Set();
    for (const x of xs) {
      const v = safeText(x);
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  function splitLicensesLangs(tags) {
    const licenses = [];
    const langs = [];

    const licRe = /(gpl|lgpl|agpl|apache|mit|bsd|mpl|isc|cc-|epl|cddl|unlicense|proprietary)/i;
    const langRe = /(python|go|golang|rust|java|javascript|typescript|c\+\+|c#|\bc\b|php|ruby|perl|lua|haskell|kotlin|scala|shell|powershell|docker|node\.js|\.net|groovy|elixir|erlang|swift)/i;

    for (const t of (tags || [])) {
      const tt = safeText(t).trim();
      if (!tt) continue;
      if (licRe.test(tt)) licenses.push(tt);
      else if (langRe.test(tt)) langs.push(tt);
    }

    return { licenses: dedupeArr(licenses), langs: dedupeArr(langs) };
  }

  function inferTagType(tag) {
    const t = safeText(tag);
    if (/^[A-Za-z0-9.+-]+$/.test(t) && (t.includes("GPL") || t.includes("MIT") || t.includes("Apache") || t.includes("BSD") || t.includes("MPL") || t.includes("LGPL") || t.includes("AGPL") || t.includes("ISC") || t.includes("CC-"))) {
      return "license";
    }
    if (/(python|go|rust|java|javascript|typescript|c\+\+|c#|php|ruby|perl|lua|haskell|kotlin|scala)/i.test(t)) {
      return "lang";
    }
    return "tag";
  }

  // -------------------------------
  // UI helpers
  // -------------------------------
  function iconForCategory(cat) {
    const c = safeText(cat).toLowerCase();
    if (c.includes("monitor")) return "📈";
    if (c.includes("backup")) return "🧰";
    if (c.includes("security") || c.includes("auth") || c.includes("oauth") || c.includes("identity")) return "🛡️";
    if (c.includes("dns")) return "🧭";
    if (c.includes("log")) return "🧾";
    if (c.includes("network")) return "🕸️";
    if (c.includes("config")) return "🧩";
    if (c.includes("virtual") || c.includes("container") || c.includes("docker") || c.includes("kubernetes")) return "📦";
    return "🧠";
  }

  function highlight(text, q) {
    const query = safeText(q).trim();
    if (!query) return escapeHTML(text);
    const tokens = query.split(/\s+/).filter(Boolean).slice(0, 3).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!tokens.length) return escapeHTML(text);
    const re = new RegExp(`(${tokens.join("|")})`, "ig");
    return escapeHTML(text).replace(re, '<mark style="background:rgba(46,226,255,.18); color:inherit; padding:0 .15em; border-radius:.35em;">$1</mark>');
  }

  // -------------------------------
  // Rendering
  // -------------------------------
  function buildFlatIndex(data) {
    const flat = [];
    const tagSet = new Set();

    for (const cat of data.categories) {
      for (const sub of cat.subcategories) {
        for (const item of sub.items) {
          for (const t of (item.tags || [])) tagSet.add(t);
          const searchText = `${item.name} ${item.description} ${item.category} ${item.subcategory} ${(item.tags || []).join(" ")} ${(item.links || []).map(l => l.label).join(" ")}`;
          flat.push({ ...item, catId: cat.id, subId: sub.id, search: searchText.toLowerCase() });
        }
      }
    }

    state.flat = flat;
    return { count: flat.length, tagCount: tagSet.size, tags: Array.from(tagSet) };
  }

  function countItemsInCategory(cat) {
    let n = 0;
    for (const sub of cat.subcategories) n += (sub.items || []).length;
    return n;
  }

  function renderControls(into) {
    const catOptions = ['<option value="">Toutes les catégories</option>']
      .concat((state.data?.categories || []).map(c => `<option value="${escapeHTML(c.title)}">${escapeHTML(c.title)}</option>`));

    const licenses = new Set();
    const languages = new Set();
    for (const it of state.flat) {
      for (const tg of (it.tags || [])) {
        const k = inferTagType(tg);
        if (k === "license") licenses.add(tg);
        if (k === "lang") languages.add(tg);
      }
    }

    const licOptions = ['<option value="">Toutes les licences</option>']
      .concat(Array.from(licenses).sort((a, b) => a.localeCompare(b)).map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`));

    const langOptions = ['<option value="">Tous les langages</option>']
      .concat(Array.from(languages).sort((a, b) => a.localeCompare(b)).map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`));

    const hasOptions = [
      '<option value="">Tous les liens</option>',
      '<option value="source">Avec “Source Code”</option>',
      '<option value="demo">Avec “Demo”</option>',
    ];

    const sortOptions = [
      '<option value="az">Tri : A → Z</option>',
      '<option value="tags">Tri : densité de tags</option>',
      '<option value="roulette">Tri : roulette découverte</option>',
    ];

    into.innerHTML = `
      <div class="row">
        <select id="fCat" aria-label="Filtre catégorie">${catOptions.join("")}</select>
      </div>
      <div class="row">
        <select id="fLic" aria-label="Filtre licence">${licOptions.join("")}</select>
        <select id="fLang" aria-label="Filtre langage">${langOptions.join("")}</select>
      </div>
      <div class="row">
        <select id="fHas" aria-label="Filtre lien">${hasOptions.join("")}</select>
        <select id="fSort" aria-label="Tri">${sortOptions.join("")}</select>
      </div>
    `;

    const fCat = $("#fCat", into);
    const fLic = $("#fLic", into);
    const fLang = $("#fLang", into);
    const fHas = $("#fHas", into);
    const fSort = $("#fSort", into);

    if (fCat) fCat.value = state.filters.category;
    if (fLic) fLic.value = state.filters.license;
    if (fLang) fLang.value = state.filters.language;
    if (fHas) fHas.value = state.filters.has;
    if (fSort) fSort.value = state.sort;

    const onChange = () => {
      state.filters.category = fCat ? fCat.value : "";
      state.filters.license = fLic ? fLic.value : "";
      state.filters.language = fLang ? fLang.value : "";
      state.filters.has = fHas ? fHas.value : "";
      state.sort = fSort ? fSort.value : "az";
      applySearchAndFilters();
    };

    [fCat, fLic, fLang, fHas, fSort].forEach(el => el && el.addEventListener("change", onChange));
  }

  function renderTOC() {
    const make = (listEl) => {
      listEl.innerHTML = (state.data?.categories || []).map(cat => {
        const count = countItemsInCategory(cat);
        return `<li><a href="#${escapeHTML(cat.id)}" data-id="${escapeHTML(cat.id)}"><span>${escapeHTML(cat.title)}</span><span class="badge-mini">${count}</span></a></li>`;
      }).join("");

      $$("a", listEl).forEach(a => {
        a.addEventListener("click", () => {
          if (listEl === els.drawerToc) closeDrawer();
        });
      });
    };

    make(els.toc);
    make(els.drawerToc);
  }

  function renderPortals() {
    const cats = (state.data?.categories || []).slice(0, 12);
    els.portals.innerHTML = cats.map(c => {
      const n = countItemsInCategory(c);
      return `<a class="portal" href="#${escapeHTML(c.id)}">
        <span class="dot" aria-hidden="true"></span>
        <span>
          <div class="t">${escapeHTML(c.title)}</div>
          <div class="s">${n} outils</div>
        </span>
      </a>`;
    }).join("");
  }

  function renderAbout() {
    const links = state.data?.aboutLinks || [];
    if (!links.length) {
      els.aboutLinks.innerHTML = '<span class="pill">Aucun lien “contribution” détecté automatiquement.</span>';
      return;
    }
    els.aboutLinks.innerHTML = links.slice(0, 12).map(l =>
      `<a class="chip" href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.text)}</a>`
    ).join("");
  }

  function renderStats(meta) {
    els.statCats.textContent = String(state.data?.categories?.length || 0);
    els.statItems.textContent = String(meta.count || 0);
    els.statTags.textContent = String(meta.tagCount || 0);
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i), h |= 0;
    return Math.abs(h);
  }

  function renderContent(filteredFlat, query) {
    const byCat = new Map();
    for (const it of filteredFlat) {
      if (!byCat.has(it.catId)) byCat.set(it.catId, new Map());
      const bySub = byCat.get(it.catId);
      if (!bySub.has(it.subId)) bySub.set(it.subId, []);
      bySub.get(it.subId).push(it);
    }

    const cats = state.data?.categories || [];
    const parts = [];

    for (const cat of cats) {
      const subMap = byCat.get(cat.id);
      if (!subMap) continue;

      const total = Array.from(subMap.values()).reduce((a, arr) => a + arr.length, 0);

      parts.push(`
        <section class="card section" id="${escapeHTML(cat.id)}" data-section>
          <div class="section-head">
            <div>
              <h3>${escapeHTML(cat.title)}</h3>
              <div class="meta">${total} outil(s)</div>
            </div>
            <div class="meta">${escapeHTML(iconForCategory(cat.title))}</div>
          </div>
          <div class="inner" style="padding:0;">
      `);

      for (const sub of cat.subcategories) {
        const items = subMap.get(sub.id);
        if (!items || !items.length) continue;

        const sorted = items.slice();
        if (state.sort === "az") {
          sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else if (state.sort === "tags") {
          sorted.sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0) || a.name.localeCompare(b.name));
        } else if (state.sort === "roulette") {
          sorted.sort((a, b) => hash(a.name) - hash(b.name));
          const rot = Math.floor(Date.now() / 60000) % (sorted.length || 1);
          for (let i = 0; i < rot; i++) sorted.push(sorted.shift());
        }

        parts.push(`<div class="hint" style="padding:12px 16px 4px; font-family:var(--mono);">${escapeHTML(sub.title)}</div>`);
        parts.push(`<div class="grid">`);

        for (const it of sorted) {
          const tags = (it.tags || []).slice(0, 10);
          const links = (it.links || []).slice(0, 6);

          parts.push(`
            <article class="tool" id="${escapeHTML(it.id)}" data-item>
              <div class="inner">
                <div class="top">
                  <h4>${highlight(it.name, query)}</h4>
                  <span class="badge-mini" title="Catégorie">${escapeHTML(iconForCategory(it.category))}</span>
                </div>
                <p>${highlight(it.description, query)}</p>
                <div class="chips" aria-label="Liens">
                  ${links.map(l => `<a class="chip" href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`).join("")}
                </div>
              </div>
              <div class="footer">
                <div class="mini" aria-label="Tags">
                  ${tags.length ? tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join("") : `<span class="tag">—</span>`}
                </div>
                <button class="copy" data-copy="#${escapeHTML(it.id)}" aria-label="Copier le lien">🔗 Copier</button>
              </div>
            </article>
          `);
        }

        parts.push(`</div>`);
      }

      parts.push(`</div></section>`);
    }

    els.content.innerHTML = parts.join("") || `
      <div class="card">
        <div class="inner">
          <h3>Aucun résultat</h3>
          <p class="tagline">Essaie une autre recherche ou enlève des filtres.</p>
        </div>
      </div>
    `;

    // Copy handlers
    $$('button[data-copy]', els.content).forEach(btn => {
      btn.addEventListener("click", async () => {
        const hash = btn.getAttribute("data-copy") || "";
        const url = location.origin && location.origin !== "null"
          ? (location.origin + location.pathname + hash)
          : (location.href.split("#")[0] + hash);

        try {
          await navigator.clipboard.writeText(url);
          toast("Lien copié ✨");
        } catch {
          try {
            const ta = document.createElement("textarea");
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            toast("Lien copié ✨");
          } catch (e) {
            console.error(e);
            toast("Impossible de copier");
          }
        }
      });
    });

    // Tilt (if motion allowed)
    if (!prefersReducedMotion()) {
      $$("article.tool", els.content).forEach(card => {
        card.addEventListener("mousemove", (ev) => {
          const r = card.getBoundingClientRect();
          const x = (ev.clientX - r.left) / r.width - 0.5;
          const y = (ev.clientY - r.top) / r.height - 0.5;
          const tiltX = (-y * 6).toFixed(2);
          const tiltY = (x * 8).toFixed(2);
          card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-1px)`;
        });
        card.addEventListener("mouseleave", () => { card.style.transform = ""; });
      });
    }

    initSectionObserver();
  }

  function applySearchAndFilters() {
    const q = safeText(els.q.value).trim().toLowerCase();
    state.lastQuery = q;

    let items = state.flat;

    if (state.filters.category) items = items.filter(it => it.category === state.filters.category);
    if (state.filters.license) items = items.filter(it => (it.licenses || []).includes(state.filters.license));
    if (state.filters.language) items = items.filter(it => (it.langs || []).includes(state.filters.language));

    if (state.filters.has) {
      if (state.filters.has === "source") {
        items = items.filter(it => (it.links || []).some(l => /source\s*code/i.test(l.label)));
      } else if (state.filters.has === "demo") {
        items = items.filter(it => (it.links || []).some(l => /demo/i.test(l.label)));
      }
    }

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);
      items = items.filter(it => tokens.every(t => it.search.includes(t)));
    }

    els.resultCount.textContent = `${items.length} résultat(s)`;
    renderContent(items, q);
  }

  function toggleFocus() {
    state.focus = !state.focus;
    document.body.classList.toggle("focus", state.focus);
    const main = document.getElementById("explorer");
    if (main) main.style.gridTemplateColumns = state.focus ? "1fr" : "";
    toast(state.focus ? "Mode focus activé" : "Mode focus désactivé");
  }

  function toggleCompact() {
    state.compact = !state.compact;
    document.body.classList.toggle("compact", state.compact);

    const id = "compactStyle";
    const existing = document.getElementById(id);
    if (state.compact) {
      if (!existing) {
        const st = document.createElement("style");
        st.id = id;
        st.textContent = `.tool .inner{ padding: 12px; } .tool p{ margin:6px 0 8px; } .grid{ gap:10px; }`;
        document.head.appendChild(st);
      }
      toast("Mode compact activé");
    } else {
      if (existing) existing.remove();
      toast("Mode compact désactivé");
    }
  }

  function surpriseMe() {
    const cards = $$("[data-item]", els.content);
    if (!cards.length) return toast("Aucun outil à découvrir");
    const idx = Math.floor(Math.random() * cards.length);
    const el = cards[idx];
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    el.style.boxShadow = "0 0 0 3px rgba(68,255,177,.22), 0 24px 80px rgba(0,0,0,.35)";
    setTimeout(() => { el.style.boxShadow = ""; }, 1200);
    toast("Découverte ✨");
  }

  // -------------------------------
  // TOC highlight
  // -------------------------------
  let observer = null;
  function initSectionObserver() {
    if (observer) { observer.disconnect(); observer = null; }
    const sections = $$("[data-section]", els.content);
    if (!sections.length) return;

    observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      const id = visible[0].target.id;
      if (id && id !== state.activeSection) {
        state.activeSection = id;
        highlightTOC(id);
      }
    }, { threshold: [0.2, 0.35, 0.5, 0.65] });

    sections.forEach(s => observer.observe(s));
  }

  function highlightTOC(id) {
    const mark = (list) => {
      $$("a", list).forEach(a => {
        const is = a.getAttribute("data-id") === id;
        a.setAttribute("aria-current", is ? "true" : "false");
      });
    };
    mark(els.toc);
    mark(els.drawerToc);
  }

  // -------------------------------
  // Progress
  // -------------------------------
  function updateProgress() {
    const h = document.documentElement;
    const st = h.scrollTop || document.body.scrollTop;
    const sh = (h.scrollHeight - h.clientHeight) || 1;
    const p = Math.max(0, Math.min(1, st / sh));
    els.progress.style.width = (p * 100).toFixed(2) + "%";
  }

  // -------------------------------
  // Stars
  // -------------------------------
  function initStars() {
    const canvas = $("#stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const count = reduced ? 80 : 160;
    let w = 0, h = 0, dpr = 1;
    let stars = [];

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.2 + 0.2) * dpr,
        a: Math.random() * 0.6 + 0.25,
        s: (Math.random() * 0.35 + 0.05) * dpr,
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const st of stars) {
        st.y += st.s;
        if (st.y > h) { st.y = -10; st.x = Math.random() * w; }
        ctx.fillStyle = `rgba(255,255,255,${st.a})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reduced) requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    if (!reduced) tick();
    else {
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        ctx.fillStyle = `rgba(255,255,255,${st.a})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // -------------------------------
  // Konami
  // -------------------------------
  function initKonami() {
    const seq = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
    let i = 0;
    window.addEventListener("keydown", (ev) => {
      const k = ev.key.toLowerCase();
      if (k === seq[i]) {
        i++;
        if (i === seq.length) { i = 0; enableRetro(); }
      } else i = 0;
    });
  }

  function enableRetro() {
    const id = "retroStyle";
    const existing = document.getElementById(id);
    if (existing) { existing.remove(); toast("Mode rétro désactivé"); return; }
    const st = document.createElement("style");
    st.id = id;
    st.textContent = `
      body{ filter: saturate(1.2) contrast(1.05); }
      .card, .tool, header{ border-color: rgba(68,255,177,.25) !important; }
      .logo{ background: linear-gradient(135deg, rgba(68,255,177,.95), rgba(46,226,255,.70)) !important; }
      .search{ box-shadow: 0 18px 60px rgba(68,255,177,.15) !important; }
      .tag{ border-style: solid !important; border-color: rgba(68,255,177,.25) !important; }
    `;
    document.head.appendChild(st);
    toast("Mode rétro activé");
  }

  // -------------------------------
  // Init
  // -------------------------------
  async function init() {
    // Theme init
    const saved = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(saved || (prefersLight ? "light" : "dark"));

    initStars();

    // Events
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    els.btnTheme.addEventListener("click", toggleTheme);
    els.btnFocus.addEventListener("click", toggleFocus);
    els.btnCompact.addEventListener("click", toggleCompact);

    els.btnMenu.addEventListener("click", openDrawer);
    els.drawerBackdrop.addEventListener("click", closeDrawer);
    els.btnCloseDrawer.addEventListener("click", closeDrawer);

    els.btnTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }));
    els.btnSearch.addEventListener("click", () => els.q.focus());
    els.btnSurprise.addEventListener("click", surpriseMe);

    els.paletteBackdrop.addEventListener("click", closePalette);

    window.addEventListener("keydown", (ev) => {
      const isK = ev.key.toLowerCase() === "k";
      if ((ev.ctrlKey || ev.metaKey) && isK) {
        ev.preventDefault();
        openPalette();
      }
      if (ev.key === "Escape") {
        closePalette();
        closeDrawer();
      }
    });

    els.cmdQ.addEventListener("input", () => renderCommands(els.cmdQ.value));
    els.q.addEventListener("input", debounce(applySearchAndFilters, 80));

    // Load data: JSON first, Markdown fallback
    try {
      els.loadHint.textContent = "Chargement de data.json…";
      state.data = await tryLoadJSON();
      els.loadHint.textContent = "Données chargées : data.json (descriptions FR).";
    } catch (e1) {
      console.warn("JSON load failed, fallback to markdown:", e1);
      try {
        els.loadHint.textContent = "data.json absent — parsing du Markdown…";
        state.data = await tryLoadMarkdownAndParse();
        els.loadHint.textContent = `Données chargées : ${state.data._source || "Markdown"} (FR indisponible → fallback EN).`;
      } catch (e2) {
        console.error(e2);
        els.loadHint.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div><strong>⚠️ Chargement impossible.</strong></div>
            <div>Place <span class="pill" style="font-family:var(--mono);">data.json</span> (recommandé) ou le Markdown (<span class="pill" style="font-family:var(--mono);">awesome-sysadmin.md</span> / README.md) à côté du site.</div>
          </div>
        `;
        state.data = { title: "Awesome Sysadmin", description: "", categories: [], aboutLinks: [] };
      }
    }

    // Page title
    if (state.data?.title) {
      document.title = `${state.data.title} — Cyber DevOps Playground`;
      els.siteTitle.textContent = state.data.title;
    }

    // Build index + render UI
    const meta = buildFlatIndex(state.data);
    renderControls(els.controls);
    renderControls(els.drawerControls);
    renderTOC();
    renderPortals();
    renderAbout();
    renderStats(meta);

    applySearchAndFilters();
    initKonami();
  }

  init();
})();