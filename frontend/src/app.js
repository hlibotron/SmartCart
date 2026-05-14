import "./styles/main.css";
import { navigationItems } from "./data/navigation.js";
import { routes } from "./router.js";
import { cartIcon, icon } from "./shared/icons.js";
import { appHref, stripBasePath } from "./shared/navigation.js";

const app = document.querySelector("#app");

const pageTitle = document.title;

function getRoute(pathname = window.location.pathname) {
  return routes[stripBasePath(pathname)] ?? routes["/"];
}

function renderDemoSwitcher() {
  return `
    <nav class="demo-switcher" aria-label="Перемикання демо-режиму">
      <a class="demo-switcher-link active interactive" href="${appHref("/")}" data-link aria-current="page">
        Клієнт
      </a>
      <a class="demo-switcher-link interactive" href="${appHref("/business")}" data-link>
        Бізнес
      </a>
    </nav>
  `;
}

function renderHeader(route) {
  const profileActive = (route.navPath ?? route.path) === "/profile";

  return `
    <header class="top" aria-label="Верхня панель">
      ${renderDemoSwitcher()}
      <div class="brand-row${route.backPath ? " has-back" : ""}">
        ${
          route.backPath
            ? `
              <a class="back-button interactive" href="${appHref(route.backPath)}" data-link aria-label="Назад">
                ${icon("arrowLeft")}
              </a>
            `
            : ""
        }
        <a class="brand" href="${appHref("/")}" data-link aria-label="SmartCart головна">
          ${cartIcon("brand-icon")}
          <span>Smart<span>Cart</span></span>
        </a>
        <div class="header-actions">
          <a
            class="icon-button interactive${profileActive ? " active" : ""}"
            href="${appHref("/profile")}"
            data-link
            data-page="Профіль"
            aria-label="Профіль"
            ${profileActive ? 'aria-current="page"' : ""}
          >
            ${icon("user")}
          </a>
          <button class="icon-button interactive" type="button" aria-label="Сповіщення">
            ${icon("bell")}
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderBottomNav(activePath) {
  const navItems = navigationItems.filter((item) => item.path !== "/profile");

  return `
    <nav class="bottom-nav" aria-label="Основна навігація">
      ${navItems
        .map((item) => {
          const active = item.path === activePath;
          const scanButton =
            item.path === "/receipts"
              ? `
                <button
                  class="nav-scan-button interactive"
                  type="button"
                  id="bottomScanButton"
                  aria-label="Сканувати чек"
                >
                  ${icon("camera")}
                  <span>Скан</span>
                </button>
              `
              : "";

          return `
            <a
              class="nav-item interactive${active ? " active" : ""}"
              href="${appHref(item.path)}"
              data-link
              data-page="${item.label}"
              ${active ? 'aria-current="page"' : ""}
            >
              ${icon(item.icon)}
              <span>${item.label}</span>
            </a>
            ${scanButton}
          `;
        })
        .join("")}
      <input
        class="receipt-camera-input"
        id="globalReceiptCameraInput"
        type="file"
        accept="image/*"
        capture="environment"
      />
    </nav>
  `;
}

function renderBusinessShell(route) {
  return `
    <div class="business-shell">
      ${route.render()}
    </div>
  `;
}

function renderApp() {
  const route = getRoute();

  document.title = route.title ? `${route.title} | SmartCart` : pageTitle;
  app.innerHTML =
    route.layout === "business"
      ? renderBusinessShell(route)
      : `
      <div class="app-shell">
        <div class="phone-frame">
          ${renderHeader(route)}
          <main class="content" id="page" tabindex="-1">
            ${route.render()}
          </main>
          ${renderBottomNav(route.navPath ?? route.path)}
        </div>
      </div>
    `;

  bindGlobalInteractions();
  route.bind?.();
}

function navigateTo(path) {
  const currentPath = `${stripBasePath(window.location.pathname)}${window.location.search}`;

  if (currentPath === path) {
    renderApp();
    return;
  }

  window.history.pushState({}, "", appHref(path));
  renderApp();
  document.querySelector("#page")?.focus({ preventScroll: true });
}

function setGlobalScanPending(isPending) {
  const scanButton = document.querySelector("#bottomScanButton");
  if (!scanButton) {
    return;
  }

  scanButton.disabled = isPending;
  scanButton.classList.toggle("is-loading", isPending);
}

async function uploadReceiptPhoto(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/receipt-scans/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.detail || `Помилка сканування: ${response.status}`);
  }

  const result = await response.json();
  const receiptId = result.receipt_id;
  if (!receiptId) {
    throw new Error("Сервер не повернув ID чеку");
  }

  navigateTo(`/receipt-summary?receipt=${encodeURIComponent(receiptId)}`);
}

function bindGlobalInteractions() {
  document.querySelectorAll("[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const url = new URL(link.href);

      if (url.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();

      if (link.dataset.page) {
        console.log(`Navigate to: ${link.dataset.page}`);
      }

      navigateTo(`${stripBasePath(url.pathname)}${url.search}`);
    });
  });

  document.querySelectorAll(".interactive").forEach((item) => {
    item.addEventListener("pointerdown", () => item.classList.add("is-pressed"));
    item.addEventListener("pointerup", () => item.classList.remove("is-pressed"));
    item.addEventListener("pointercancel", () => item.classList.remove("is-pressed"));
    item.addEventListener("pointerleave", () => item.classList.remove("is-pressed"));
  });

  const globalCameraInput = document.querySelector("#globalReceiptCameraInput");
  document.querySelector("#bottomScanButton")?.addEventListener("click", () => {
    globalCameraInput?.click();
  });

  globalCameraInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    setGlobalScanPending(true);
    try {
      await uploadReceiptPhoto(file);
    } catch (error) {
      console.warn(error.message);
    } finally {
      setGlobalScanPending(false);
      event.target.value = "";
    }
  });
}

window.addEventListener("popstate", renderApp);

renderApp();
