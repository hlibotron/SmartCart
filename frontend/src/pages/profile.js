import { icon } from "../shared/icons.js";

export function renderProfilePage() {
  return `
    <h1>Профіль</h1>
    <section class="page-card">
      <span class="round-icon">${icon("user")}</span>
      <h2>SmartCart профіль</h2>
      <p>Персональні налаштування та прогрес кешбеку</p>
    </section>
  `;
}
