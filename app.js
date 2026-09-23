(function () {
  "use strict";

  const CATEGORIES = ["全部", "麵包", "原材料"];
  const STORAGE_KEY = "warehouse-custom-items-v1";
  const baseItems = Array.isArray(WAREHOUSE_ITEMS)
    ? WAREHOUSE_ITEMS.map((it) => ({ ...it, _custom: false }))
    : [];
  const meta =
    typeof WAREHOUSE_META === "object" && WAREHOUSE_META ? WAREHOUSE_META : {};

  /** @type {Array<object>} */
  let items = [];

  const els = {
    search: document.getElementById("search"),
    clear: document.getElementById("clearSearch"),
    chips: document.getElementById("chips"),
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    count: document.getElementById("resultCount"),
    lightbox: document.getElementById("lightbox"),
    lbMedia: document.getElementById("lbMedia"),
    lbId: document.getElementById("lbId"),
    lbBadge: document.getElementById("lbBadge"),
    lbName: document.getElementById("lbName"),
    lbDesc: document.getElementById("lbDesc"),
    lbStorage: document.getElementById("lbStorage"),
    btnAdd: document.getElementById("btnAdd"),
    addModal: document.getElementById("addModal"),
    addForm: document.getElementById("addForm"),
    addId: document.getElementById("addId"),
    addName: document.getElementById("addName"),
    addCategory: document.getElementById("addCategory"),
    addDesc: document.getElementById("addDesc"),
    addStorage: document.getElementById("addStorage"),
    addImageCamera: document.getElementById("addImageCamera"),
    addImageGallery: document.getElementById("addImageGallery"),
    imagePreview: document.getElementById("imagePreview"),
    imagePreviewWrap: document.getElementById("imagePreviewWrap"),
    clearPhoto: document.getElementById("clearPhoto"),
    btnCamera: document.getElementById("btnCamera"),
    btnGallery: document.getElementById("btnGallery"),
    idHint: document.getElementById("idHint"),
    addError: document.getElementById("addError"),
  };

  /** @type {File|null} */
  let pendingImageFile = null;
  /** @type {string|null} */
  let pendingImageDataUrl = null;

  if (meta.searchPlaceholder) {
    els.search.placeholder = meta.searchPlaceholder;
  }
  if (meta.pageTitle) {
    document.title = meta.pageTitle;
  }

  let activeCategory = "全部";
  let query = "";
  let lastFocus = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    const parts = q.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return safe;
    const re = new RegExp(
      "(" + parts.map(escapeRegExp).map(escapeHtml).join("|") + ")",
      "gi"
    );
    return safe.replace(re, '<mark class="mark">$1</mark>');
  }

  function normalizeId(raw) {
    let id = String(raw || "").trim();
    if (!id) return "";
    if (!id.startsWith("#")) id = "#" + id;
    return id;
  }

  function loadCustom() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveCustom(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function mergeItems() {
    const custom = loadCustom().map((it) => ({ ...it, _custom: true }));
    const byId = new Map();
    for (const it of baseItems) {
      byId.set(it.id, { ...it, _custom: false });
    }
    for (const it of custom) {
      if (!it || !it.id) continue;
      byId.set(it.id, { ...it, _custom: true });
    }
    // Preserve base order, then append purely custom ids not in base
    const baseIds = new Set(baseItems.map((i) => i.id));
    items = baseItems.map((b) => byId.get(b.id));
    for (const it of custom) {
      if (it && it.id && !baseIds.has(it.id)) {
        items.push(byId.get(it.id));
      }
    }
  }

  function categoryCounts() {
    const counts = { 全部: items.length, 麵包: 0, 原材料: 0 };
    for (const it of items) {
      if (counts[it.category] != null) counts[it.category]++;
    }
    return counts;
  }

  function matches(item, q) {
    if (!q) return true;
    const hay = (
      (item.id || "") +
      " " +
      (item.name || "") +
      " " +
      (item.description || "") +
      " " +
      (item.storage || "")
    ).toLowerCase();
    const parts = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return parts.every((p) => hay.includes(p));
  }

  function filtered() {
    return items.filter((it) => {
      if (activeCategory !== "全部" && it.category !== activeCategory)
        return false;
      return matches(it, query);
    });
  }

  function iconSvg(category) {
    if (category === "麵包") {
      return `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <ellipse cx="24" cy="28" rx="16" ry="10" stroke="currentColor" stroke-width="2.2"/>
        <path d="M10 26c2-10 8-16 14-16s12 6 14 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 22c1.5-1 3-1.5 4.5-1.5M23 19.5c1.5-.3 3-.3 4.5.2M30 21c1.2.4 2.3 1 3.2 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }
    return `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="14" width="32" height="24" rx="3" stroke="currentColor" stroke-width="2.2"/>
      <path d="M8 22h32M18 14V10a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="18" cy="30" r="2" fill="currentColor"/>
      <circle cx="24" cy="30" r="2" fill="currentColor"/>
      <circle cx="30" cy="30" r="2" fill="currentColor"/>
    </svg>`;
  }

  function storageIcon() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/>
    </svg>`;
  }

  function mediaHtml(item, large) {
    const catClass = item.category === "麵包" ? "麵包" : "原材料";
    if (item.image) {
      const loading = large ? "eager" : "lazy";
      return `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="${loading}" decoding="async" />`;
    }
    return `<div class="card-placeholder cat-${catClass}">${iconSvg(item.category)}<span>暫無圖片</span></div>`;
  }

  function renderChips() {
    const counts = categoryCounts();
    els.chips.innerHTML = CATEGORIES.map((cat) => {
      const selected = cat === activeCategory;
      return `<button type="button" class="chip" role="tab" data-category="${escapeHtml(cat)}" aria-selected="${selected}">
        ${escapeHtml(cat)}
        <span class="chip-count">${counts[cat] ?? 0}</span>
      </button>`;
    }).join("");
  }

  function cardHtml(item, index) {
    const desc =
      item.description && item.description.trim() ? item.description : "";
    const descHtml = desc
      ? `<p class="card-desc">${highlight(desc, query)}</p>`
      : `<p class="card-desc empty">無描述</p>`;
    const storageHtml = item.storage
      ? `<p class="card-meta">${storageIcon()}<span>貯放倉：${escapeHtml(item.storage)}</span></p>`
      : "";
    const catClass = item.category === "麵包" ? "麵包" : "原材料";
    const customClass = item._custom ? " is-custom" : "";
    const customTag = item._custom
      ? `<span class="card-custom-tag">自訂</span>`
      : "";
    const deleteBtn = item._custom
      ? `<div class="card-custom-actions"><button type="button" class="btn-danger" data-delete-custom="${escapeHtml(item.id)}">刪除自訂</button></div>`
      : "";
    return `<article class="card${customClass}" tabindex="0" role="button" data-index="${index}" data-id="${escapeHtml(item.id)}">
      <div class="card-media">
        <span class="badge badge-${catClass} card-badge-float">${escapeHtml(item.category)}</span>
        ${mediaHtml(item, false)}
      </div>
      <div class="card-body">
        <span class="card-id">${highlight(item.id, query)}${customTag}</span>
        <h2 class="card-name">${highlight(item.name, query)}</h2>
        ${descHtml}
        ${storageHtml}
        ${deleteBtn}
      </div>
    </article>`;
  }

  function render() {
    const list = filtered();
    const total = items.length;
    els.count.textContent =
      query || activeCategory !== "全部"
        ? `顯示 ${list.length} / ${total} 項貨品`
        : `共 ${total} 項貨品`;

    if (!list.length) {
      els.grid.innerHTML = "";
      els.empty.hidden = false;
    } else {
      els.empty.hidden = true;
      els.grid.innerHTML = list
        .map((it) => {
          const index = items.indexOf(it);
          return cardHtml(it, index);
        })
        .join("");
    }

    els.clear.hidden = !query;
  }

  function openLightbox(item) {
    if (!item) return;
    lastFocus = document.activeElement;
    const catClass = item.category === "麵包" ? "麵包" : "原材料";
    els.lbMedia.innerHTML = mediaHtml(item, true);
    els.lbId.textContent = item.id;
    els.lbBadge.textContent = item.category;
    els.lbBadge.className = "badge badge-" + catClass;
    els.lbName.textContent = item.name;
    const desc =
      item.description && item.description.trim() ? item.description : "";
    if (desc) {
      els.lbDesc.textContent = desc;
      els.lbDesc.className = "lightbox-desc";
    } else {
      els.lbDesc.textContent = "無描述";
      els.lbDesc.className = "lightbox-desc empty";
    }
    if (item.storage) {
      els.lbStorage.hidden = false;
      els.lbStorage.innerHTML =
        storageIcon() + `<span>貯放倉：${escapeHtml(item.storage)}</span>`;
    } else {
      els.lbStorage.hidden = true;
      els.lbStorage.innerHTML = "";
    }
    els.lightbox.hidden = false;
    document.body.classList.add("modal-open");
    const closeBtn = els.lightbox.querySelector(".lightbox-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (els.lightbox.hidden) return;
    els.lightbox.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function openAddModal() {
    lastFocus = document.activeElement;
    els.addError.hidden = true;
    els.addError.textContent = "";
    els.addForm.reset();
    clearPhotoState();
    if (els.idHint) {
      els.idHint.classList.remove("warn");
      els.idHint.textContent =
        "多數貨品編號為 8 位數字；可保留你輸入的編號。";
    }
    els.addModal.hidden = false;
    document.body.classList.add("modal-open");
    els.addId.focus();
  }

  function closeAddModal() {
    if (els.addModal.hidden) return;
    els.addModal.hidden = true;
    clearPhotoState();
    if (els.lightbox.hidden) {
      document.body.classList.remove("modal-open");
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function updateIdHint() {
    if (!els.idHint) return;
    const raw = String(els.addId.value || "").trim().replace(/^#/, "");
    if (/^\d+$/.test(raw) && raw.length !== 8) {
      els.idHint.classList.add("warn");
      els.idHint.textContent =
        "提示：多數貨品編號為 8 位數字（你輸入了 " +
        raw.length +
        " 位）。仍會保留你輸入的編號。";
    } else {
      els.idHint.classList.remove("warn");
      els.idHint.textContent =
        "多數貨品編號為 8 位數字；可保留你輸入的編號。";
    }
  }

  function clearPhotoState() {
    pendingImageFile = null;
    pendingImageDataUrl = null;
    if (els.addImageCamera) els.addImageCamera.value = "";
    if (els.addImageGallery) els.addImageGallery.value = "";
    if (els.imagePreview) {
      els.imagePreview.removeAttribute("src");
      els.imagePreview.hidden = true;
    }
    if (els.imagePreviewWrap) els.imagePreviewWrap.hidden = true;
  }

  function showImagePreview(dataUrl) {
    if (!els.imagePreview) return;
    els.imagePreview.src = dataUrl;
    els.imagePreview.hidden = false;
    if (els.imagePreviewWrap) els.imagePreviewWrap.hidden = false;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  }

  /** Compress to max edge 1280px, JPEG ~0.72 */
  async function compressImageFile(file) {
    if (!file) return null;
    const rawUrl = await readFileAsDataUrl(file);
    if (!rawUrl) return null;
    try {
      const img = await loadImageElement(rawUrl);
      const maxEdge = 1280;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) return rawUrl;
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rawUrl;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch (_) {
      return rawUrl;
    }
  }

  async function handleImageInputChange(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    pendingImageFile = file;
    try {
      const dataUrl = await compressImageFile(file);
      pendingImageDataUrl = dataUrl;
      if (dataUrl) showImagePreview(dataUrl);
    } catch (_) {
      pendingImageFile = null;
      pendingImageDataUrl = null;
      if (els.addError) {
        els.addError.textContent = "圖片讀取失敗，請再試一次。";
        els.addError.hidden = false;
      }
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    els.addError.hidden = true;
    const id = normalizeId(els.addId.value);
    const name = String(els.addName.value || "").trim();
    const category = String(els.addCategory.value || "").trim();
    const description = String(els.addDesc.value || "").trim();
    const storage = String(els.addStorage.value || "").trim() || null;

    if (!id || id === "#") {
      els.addError.textContent = "請填寫編號。";
      els.addError.hidden = false;
      els.addId.focus();
      return;
    }
    if (!name) {
      els.addError.textContent = "請填寫名稱。";
      els.addError.hidden = false;
      els.addName.focus();
      return;
    }
    if (category !== "麵包" && category !== "原材料") {
      els.addError.textContent = "分類須為「麵包」或「原材料」。";
      els.addError.hidden = false;
      return;
    }
    if (!description) {
      els.addError.textContent = "請填寫描述（所有貨品都需要描述）。";
      els.addError.hidden = false;
      els.addDesc.focus();
      return;
    }

    let image = null;
    if (pendingImageDataUrl) {
      image = pendingImageDataUrl;
    } else if (pendingImageFile) {
      try {
        image = await compressImageFile(pendingImageFile);
      } catch (_) {
        els.addError.textContent = "圖片讀取失敗，請再試一次。";
        els.addError.hidden = false;
        return;
      }
    }

    const entry = {
      id,
      name,
      category,
      description,
      storage,
      image,
      _custom: true,
    };

    const custom = loadCustom().filter((it) => it && it.id !== id);
    custom.push(entry);
    saveCustom(custom);
    mergeItems();
    renderChips();
    render();
    closeAddModal();
    els.search.focus();
    els.search.select();
  }

  function deleteCustom(id) {
    const custom = loadCustom().filter((it) => it && it.id !== id);
    saveCustom(custom);
    mergeItems();
    renderChips();
    render();
  }

  els.chips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activeCategory = btn.dataset.category;
    renderChips();
    render();
  });

  function openCardFromEl(card) {
    if (!card) return;
    const index = Number(card.dataset.index);
    openLightbox(items[index]);
  }

  els.grid.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete-custom]");
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      const id = del.getAttribute("data-delete-custom");
      if (id && confirm("確定刪除此自訂貨品？")) {
        deleteCustom(id);
      }
      return;
    }
    openCardFromEl(e.target.closest(".card"));
  });

  els.grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("[data-delete-custom]")) return;
    const card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    openCardFromEl(card);
  });

  els.lightbox.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) {
      closeLightbox();
    }
  });

  if (els.btnAdd) {
    els.btnAdd.addEventListener("click", openAddModal);
  }

  if (els.addModal) {
    els.addModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-add]")) {
        closeAddModal();
      }
    });
  }

  if (els.addForm) {
    els.addForm.addEventListener("submit", handleAddSubmit);
  }

  if (els.addId) {
    els.addId.addEventListener("input", updateIdHint);
  }

  els.search.addEventListener("input", () => {
    query = els.search.value;
    render();
  });

  els.clear.addEventListener("click", () => {
    els.search.value = "";
    query = "";
    els.search.focus();
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.addModal.hidden) {
        e.preventDefault();
        closeAddModal();
        return;
      }
      if (!els.lightbox.hidden) {
        e.preventDefault();
        closeLightbox();
        return;
      }
    }
    if (
      e.key === "/" &&
      document.activeElement !== els.search &&
      els.lightbox.hidden &&
      els.addModal.hidden
    ) {
      const tag =
        (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      els.search.focus();
      els.search.select();
    }
    if (e.key === "Escape" && document.activeElement === els.search) {
      if (els.search.value) {
        els.search.value = "";
        query = "";
        render();
      } else {
        els.search.blur();
      }
    }
  });

  if (els.btnCamera && els.addImageCamera) {
    els.btnCamera.addEventListener("click", () => els.addImageCamera.click());
  }
  if (els.btnGallery && els.addImageGallery) {
    els.btnGallery.addEventListener("click", () => els.addImageGallery.click());
  }
  if (els.addImageCamera) {
    els.addImageCamera.addEventListener("change", () =>
      handleImageInputChange(els.addImageCamera)
    );
  }
  if (els.addImageGallery) {
    els.addImageGallery.addEventListener("change", () =>
      handleImageInputChange(els.addImageGallery)
    );
  }
  if (els.clearPhoto) {
    els.clearPhoto.addEventListener("click", () => {
      clearPhotoState();
    });
  }

  mergeItems();
  renderChips();
  render();
  requestAnimationFrame(() => {
    els.search.focus({ preventScroll: true });
  });

  // PWA: register service worker on https or localhost
  if ("serviceWorker" in navigator) {
    const host = location.hostname;
    const ok =
      location.protocol === "https:" ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (ok) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }
})();
