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
              href="${appHref(item.path)}"
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
}

window.addEventListener("popstate", renderApp);

renderApp();
