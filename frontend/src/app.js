import "./styles/main.css";
import { navigationItems } from "./data/navigation.js";
import { routes } from "./router.js";
import { cartIcon, icon } from "./shared/icons.js";

const app = document.querySelector("#app");

const pageTitle = document.title;

function getRoute(pathname = window.location.pathname) {
  return routes[pathname] ?? routes["/"];
}

function renderStatusBar() {
  return `
    <div class="status-bar" aria-hidden="true">
      <span class="status-time">9:41</span>
      <div class="status-icons">
        <span class="cellular"><i></i><i></i><i></i><i></i></span>
        ${icon("wifi", "wifi")}
        <span class="battery"><i></i></span>
      </div>
    </div>
  `;
}

function renderHeader(route) {
  return `
    <header class="top" aria-label="Верхня панель">
      ${renderStatusBar()}
      <div class="brand-row${route.backPath ? " has-back" : ""}">
        ${
          route.backPath
            ? `
              <a class="back-button interactive" href="${route.backPath}" data-link aria-label="Назад">
                ${icon("arrowLeft")}
              </a>
            `
            : ""
        }
        <a class="brand" href="/" data-link aria-label="SmartCart головна">
          ${cartIcon("brand-icon")}
          <span>Smart<span>Cart</span></span>
        </a>
        <button class="icon-button interactive" type="button" aria-label="Сповіщення">
          ${icon("bell")}
        </button>
      </div>
    </header>
  `;
}

function renderBottomNav(activePath) {
  return `
    <nav class="bottom-nav" aria-label="Основна навігація">
      ${navigationItems
        .map((item) => {
          const active = item.path === activePath;

          return `
            <a
              class="nav-item interactive${active ? " active" : ""}"
              href="${item.path}"
              data-link
              data-page="${item.label}"
              ${active ? 'aria-current="page"' : ""}
            >
              ${icon(item.icon)}
              <span>${item.label}</span>
            </a>
          `;
        })
        .join("")}
    </nav>
  `;
}

function renderApp() {
  const route = getRoute();

  document.title = route.title ? `${route.title} | SmartCart` : pageTitle;
  app.innerHTML = `
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
  if (window.location.pathname === path) {
    renderApp();
    return;
  }

  window.history.pushState({}, "", path);
  renderApp();
  document.querySelector("#page")?.focus({ preventScroll: true });
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

      navigateTo(url.pathname);
    });
  });

  document.querySelectorAll(".interactive").forEach((item) => {
    item.addEventListener("pointerdown", () => item.classList.add("is-pressed"));
    item.addEventListener("pointerup", () => item.classList.remove("is-pressed"));
    item.addEventListener("pointercancel", () => item.classList.remove("is-pressed"));
    item.addEventListener("pointerleave", () => item.classList.remove("is-pressed"));
  });
}

window.addEventListener("popstate", renderApp);

renderApp();
