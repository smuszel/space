const TYPE_ICONS = {
  "1t1": "\u{1F5E3}️",
  "starter": "⚡",
  "energizer": "🔥",
  "introductions": "\u{1F44B}",
  "improv": "\u{1F3AC}",
};
const DEFAULT_ICON = "⭐";

const TYPE_LABELS = {
  "1t1": "One to one",
};

function iconFor(type) {
  return TYPE_ICONS[type] || DEFAULT_ICON;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function labelFor(type) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return type.split(" ").map(capitalize).join(" ");
}

function titleFor(activity) {
  if (activity.name) return activity.name;
  return `${activity.type} exercise ${activity.typeIndex}`;
}

const state = {
  activities: [],
  selected: new Set(),
  expanded: new Set(),
  filterType: "",
  session: null, // { items: Activity[], currentId: number }
};

const els = {};
let sortableInstance = null;

function cacheEls() {
  els.screenList = document.getElementById("screen-list");
  els.screenSession = document.getElementById("screen-session");
  els.filterSelect = document.getElementById("filter-select");
  els.clearButton = document.getElementById("clear-button");
  els.startButton = document.getElementById("start-button");
  els.activityList = document.getElementById("activity-list");
  els.dots = document.getElementById("dots");
  els.closeButton = document.getElementById("close-button");
  els.prevButton = document.getElementById("prev-button");
  els.nextButton = document.getElementById("next-button");
  els.sessionCard = document.getElementById("session-card");
  els.sessionDescription = document.getElementById("session-description");
}

async function loadActivities() {
  const res = await fetch("main.json");
  const raw = await res.json();
  const typeCounters = {};
  state.activities = raw.map((activity, index) => {
    typeCounters[activity.type] = (typeCounters[activity.type] || 0) + 1;
    return { ...activity, id: index, typeIndex: typeCounters[activity.type] };
  });
}

function populateFilterOptions() {
  const types = [...new Set(state.activities.map((a) => a.type))].sort();
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = labelFor(type);
    els.filterSelect.appendChild(option);
  }
}

function visibleActivities() {
  if (!state.filterType) return state.activities;
  return state.activities.filter((a) => a.type === state.filterType);
}

function renderList() {
  const items = visibleActivities();
  els.activityList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No activities match this filter.";
    els.activityList.appendChild(empty);
  }

  for (const activity of items) {
    const isSelected = state.selected.has(activity.id);
    const isExpanded = state.expanded.has(activity.id);

    const li = document.createElement("li");
    li.className = "activity-item" + (isExpanded ? " expanded" : "");
    li.dataset.id = activity.id;

    const row = document.createElement("div");
    row.className = "activity-row";

    const icon = document.createElement("div");
    icon.className = "activity-icon";
    icon.textContent = iconFor(activity.type);

    const title = document.createElement("div");
    title.className = "activity-title";
    title.innerHTML = `${titleFor(activity)}<span class="type-tag">${labelFor(activity.type)}</span>`;

    const selectToggle = document.createElement("button");
    selectToggle.className = "select-toggle" + (isSelected ? " selected" : "");
    selectToggle.setAttribute("aria-label", isSelected ? "Deselect" : "Select");
    selectToggle.textContent = isSelected ? "✓" : "+";
    selectToggle.addEventListener("click", () => toggleSelect(activity.id));

    const expandToggle = document.createElement("button");
    expandToggle.className = "expand-toggle" + (isExpanded ? " expanded" : "");
    expandToggle.setAttribute("aria-label", isExpanded ? "Collapse" : "Expand");
    expandToggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>';
    expandToggle.addEventListener("click", () => toggleExpand(activity.id));

    row.append(icon, title, selectToggle, expandToggle);

    const detail = document.createElement("div");
    detail.className = "activity-detail";
    const detailInner = document.createElement("div");
    detailInner.className = "activity-detail-inner";
    let detailHtml = activity.description;
    if (activity.iteration) {
      detailHtml += `<span class="iteration-label">Iteration</span>${activity.iteration}`;
    }
    if (activity.variant) {
      detailHtml += `<span class="iteration-label">Variant</span>${activity.variant}`;
    }
    detailInner.innerHTML = detailHtml;
    detail.appendChild(detailInner);

    li.append(row, detail);
    els.activityList.appendChild(li);
  }

  renderSelectionControls();
}

function renderSelectionControls() {
  const count = state.selected.size;
  els.startButton.textContent = `Start: ${count}`;
  els.startButton.disabled = count === 0;
  els.clearButton.disabled = count === 0;
}

function toggleSelect(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  renderList();
}

function clearSelection() {
  state.selected.clear();
  renderList();
}

// A targeted DOM update rather than a full renderList(): the CSS transition
// on .activity-detail only animates when the element's max-height actually
// changes on an element that already exists. Destroying and recreating the
// <li> (as a full re-render would) makes it appear already in its final
// state, so the transition never gets a "before" frame to animate from.
function toggleExpand(id) {
  const isExpanded = !state.expanded.has(id);
  if (isExpanded) {
    state.expanded.add(id);
  } else {
    state.expanded.delete(id);
  }

  const li = els.activityList.querySelector(`[data-id="${id}"]`);
  if (!li) return;
  li.classList.toggle("expanded", isExpanded);
  const toggle = li.querySelector(".expand-toggle");
  toggle.classList.toggle("expanded", isExpanded);
  toggle.setAttribute("aria-label", isExpanded ? "Collapse" : "Expand");

  // Measure the real content height rather than relying on the CSS fallback's
  // fixed cap: animating against a cap much larger than the actual content
  // makes the transition look like it finishes almost instantly.
  const detail = li.querySelector(".activity-detail");
  detail.style.maxHeight = isExpanded ? `${detail.scrollHeight}px` : "0px";
}

function showScreen(name) {
  els.screenList.classList.toggle("active", name === "list");
  els.screenSession.classList.toggle("active", name === "session");
}

function startSession() {
  const items = state.activities.filter((a) => state.selected.has(a.id));
  if (items.length === 0) return;
  state.session = { items, currentId: items[0].id };
  showScreen("session");
  renderSession();
}

function closeSession() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  state.session = null;
  showScreen("list");
}

function currentIndex() {
  const { items, currentId } = state.session;
  return items.findIndex((item) => item.id === currentId);
}

function renderSession() {
  const { items } = state.session;
  const index = currentIndex();
  const current = items[index];

  els.dots.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "icon-chip" + (item.id === current.id ? " current" : "");
    chip.textContent = iconFor(item.type);
    chip.title = titleFor(item);
    chip.dataset.id = item.id;

    chip.addEventListener("click", () => {
      state.session.currentId = item.id;
      renderSession();
    });

    els.dots.appendChild(chip);
  });

  setUpReordering();

  els.sessionCard.innerHTML = `
    <div class="session-title">${titleFor(current)}</div>
    <div class="session-type">${labelFor(current.type)}</div>
  `;

  let descriptionHtml = current.description;
  if (current.iteration) {
    descriptionHtml += `<span class="iteration-label">Iteration</span>${current.iteration}`;
  }
  if (current.variant) {
    descriptionHtml += `<span class="iteration-label">Variant</span>${current.variant}`;
  }
  els.sessionDescription.innerHTML = descriptionHtml;

  els.prevButton.disabled = index === 0;

  const isLast = index === items.length - 1;
  els.nextButton.classList.toggle("is-hidden", isLast);
}

// Reordering the icon rail: SortableJS (loaded from CDN) gives smooth,
// touch-friendly drag animation. If the CDN failed to load, fall back to
// a plain native HTML5 drag-and-drop implementation with the same result.
function setUpReordering() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  if (window.Sortable && !window.__sortableLoadFailed) {
    sortableInstance = Sortable.create(els.dots, {
      animation: 150,
      draggable: ".icon-chip",
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        reorderAndAnimate(evt.oldIndex, evt.newIndex);
      },
    });
    return;
  }

  bindNativeDragAndDrop();
}

function bindNativeDragAndDrop() {
  const chips = els.dots.querySelectorAll(".icon-chip");
  chips.forEach((chip) => {
    chip.draggable = true;

    chip.addEventListener("dragstart", (e) => {
      chip.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", chip.dataset.id);
    });

    chip.addEventListener("dragend", () => {
      chip.classList.remove("dragging");
    });

    chip.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    chip.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = Number(e.dataTransfer.getData("text/plain"));
      const targetId = Number(chip.dataset.id);
      const { items } = state.session;
      const fromIndex = items.findIndex((item) => item.id === draggedId);
      const toIndex = items.findIndex((item) => item.id === targetId);
      reorderAndAnimate(fromIndex, toIndex);
    });
  });
}

// Moves an item in state.session.items and animates the icon rail into its
// new layout using the FLIP technique (record positions, mutate + re-render,
// then transition from the old position back to rest). SortableJS already
// animates the drag gesture itself; this covers the native-DnD fallback and
// is a harmless no-op for chips that didn't actually move.
function reorderAndAnimate(fromIndex, toIndex) {
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
  const rectsBefore = captureChipRects();
  const { items } = state.session;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  renderSession();
  playFlipAnimation(rectsBefore);
}

function captureChipRects() {
  const rects = {};
  els.dots.querySelectorAll(".icon-chip").forEach((chip) => {
    rects[chip.dataset.id] = chip.getBoundingClientRect();
  });
  return rects;
}

function playFlipAnimation(rectsBefore) {
  els.dots.querySelectorAll(".icon-chip").forEach((chip) => {
    const before = rectsBefore[chip.dataset.id];
    if (!before) return;
    const after = chip.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (!dx && !dy) return;
    chip.style.transition = "none";
    chip.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      chip.style.transition = "transform 200ms ease";
      chip.style.transform = "";
    });
  });
}

function goPrev() {
  if (!state.session) return;
  const index = currentIndex();
  if (index === 0) return;
  state.session.currentId = state.session.items[index - 1].id;
  renderSession();
}

function goNext() {
  if (!state.session) return;
  const { items } = state.session;
  const index = currentIndex();
  if (index === items.length - 1) return;
  state.session.currentId = items[index + 1].id;
  renderSession();
}

function bindEvents() {
  els.filterSelect.addEventListener("change", (e) => {
    state.filterType = e.target.value;
    renderList();
  });
  els.clearButton.addEventListener("click", clearSelection);
  els.startButton.addEventListener("click", startSession);
  els.closeButton.addEventListener("click", closeSession);
  els.prevButton.addEventListener("click", goPrev);
  els.nextButton.addEventListener("click", goNext);
}

async function init() {
  cacheEls();
  bindEvents();
  await loadActivities();
  populateFilterOptions();
  renderList();
}

init();
