import { icon } from "../shared/icons.js";

export function renderCashbackPage() {
  return `
    <h1>Кешбек</h1>
    <section class="page-card">
      <span class="round-icon">${icon("gift")}</span>
      <h2>Активні кампанії</h2>
      <p>₴46 очікує на зарахування з 2 чеків</p>
    </section>
  `;
}
