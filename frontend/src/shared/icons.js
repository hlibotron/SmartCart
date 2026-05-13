const icons = {
  analytics: '<path d="M4 20V10M10 20V5M16 20v-8M22 20V7" />',
  arrowDown: '<path d="M12 5v14" /><path d="m6 13 6 6 6-6" />',
  arrowLeft: '<path d="M19 12H5" /><path d="m12 19-7-7 7-7" />',
  arrowRight: '<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />',
  bars: '<path d="M4 19V11M10 19V7M16 19V4M22 19V13" />',
  basket:
    '<path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8a3 3 0 0 1 6 0M8 13h.01M12 13h.01M16 13h.01" />',
  bell:
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21a2 2 0 0 0 4 0" />',
  bottle:
    '<path d="M9 2h6v4l2 3v10a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9l2-3z" /><path d="M9 2h6M8 11h8" />',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />',
  camera:
    '<path d="M14.5 5.5 13 3H9L7.5 5.5H5a3 3 0 0 0-3 3V17a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8.5a3 3 0 0 0-3-3h-4.5Z" /><circle cx="12" cy="13" r="3.4" />',
  carrot:
    '<path d="M14 4c2 0 3.5 1.5 3.5 3.5L8 21l-4-4L14 4Z" /><path d="M14 4c.8-1.2 2.1-1.8 4-2M16.8 5.2c1.4-.4 2.6-.2 3.7.7M7 14l3 3" />',
  cashback:
    '<path d="M17 2v5h-5" /><path d="M20 11A8 8 0 0 0 6.2 5.5L4 7.5" /><path d="M7 22v-5h5" /><path d="M4 13a8 8 0 0 0 13.8 5.5L20 16.5" /><path d="M12 8v8" />',
  check: '<path d="m6 12.3 3.6 3.6L18.5 7" />',
  chevron: '<path d="m9 18 6-6-6-6" />',
  chevronDown: '<path d="m6 9 6 6 6-6" />',
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
  dashboard: '<rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" />',
  download: '<path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />',
  gift:
    '<path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7" /><path d="M12 7H8.4a2.4 2.4 0 1 1 2.4-2.4C10.8 7 12 7 12 7Zm0 0h3.6A2.4 2.4 0 1 0 13.2 4.6C13.2 7 12 7 12 7Z" />',
  grapes:
    '<circle cx="8" cy="9" r="3" /><circle cx="14" cy="9" r="3" /><circle cx="11" cy="14" r="3" /><circle cx="7" cy="16" r="2.5" /><circle cx="15" cy="16" r="2.5" /><path d="M13 5c1.2-1.4 2.7-2.1 4.5-2" />',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />',
  info: '<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />',
  jar:
    '<path d="M8 2h8v4l-1.5 2v11a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3V8L8 6z" /><path d="M8 6h8M8 12h8" />',
  meat:
    '<path d="M8.5 18.5c-3.2-1.2-4.8-3.4-4.2-6.1.7-3.3 4.5-4.8 8.2-4.2l2.2-2.2a3 3 0 1 1 4.3 4.3l-2.2 2.2c.6 3.7-.9 7.5-4.2 8.2-1.5.3-2.9-.1-4.1-2.2Z" /><path d="M8 14h.01" />',
  helpCircle: '<circle cx="12" cy="12" r="9" /><path d="M9.2 9a3 3 0 1 1 4.7 2.5c-1 .7-1.9 1.2-1.9 2.5" /><path d="M12 17h.01" />',
  map:
    '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15M15 6v15" />',
  mapPin:
    '<path d="M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z" /><circle cx="12" cy="9" r="2.3" />',
  milk:
    '<path d="M9 2h6v4l2 3v10a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9l2-3z" /><path d="M8 10h8M9 2h6" />',
  piggy:
    '<path d="M5 11.4a7 7 0 0 1 14 0v5.2a2 2 0 0 1-2 2h-1.2L14.5 22h-5l-1.3-3.4H7a2 2 0 0 1-2-2v-5.2Z" /><path d="M9.2 9.8h.01M14.8 9.8h.01M12 4V2M4 8.5H2" />',
  receipt:
    '<path d="M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21z" /><path d="M9 8h6M9 12h6M9 16h4" />',
  receiptCheck:
    '<path d="M6 2h10l4 4v16H6z" /><path d="M15 2v5h5M8.5 12h7M8.5 16h4" /><path d="m15.5 15.5 1.6 1.6 3.3-3.4" />',
  refresh:
    '<path d="M17 2v5h-5" /><path d="M20 11A8 8 0 0 0 6.2 5.5L4 7.5" /><path d="M7 22v-5h5" /><path d="M4 13a8 8 0 0 0 13.8 5.5L20 16.5" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" />',
  settings:
    '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H2a2.1 2.1 0 0 1 0-4.2h.2a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V2a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2a2.1 2.1 0 0 1 0 4.2h-.2a1.8 1.8 0 0 0-1.8 1.2Z" />',
  shoppingBag:
    '<path d="M6 8h12l-1 13H7z" /><path d="M9 8a3 3 0 0 1 6 0" />',
  sliders:
    '<path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3" /><circle cx="13" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="18" r="2" />',
  store:
    '<path d="M4 10h16l-1-5H5l-1 5Z" /><path d="M6 10v10h12V10" /><path d="M9 20v-6h6v6" /><path d="M4 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />',
  tag:
    '<path d="M20.5 13.5 13.5 20.5a2.1 2.1 0 0 1-3 0l-7-7a2.1 2.1 0 0 1 0-3L10.5 3.5H18a3 3 0 0 1 3 3V14" /><path d="M16 8h.01" />',
  target: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />',
  trendUp: '<path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 14 4-4 3 3 5-7" /><path d="M16 6h3v3" />',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4" />',
  user: '<path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />',
  wallet:
    '<rect x="3" y="6" width="18" height="13" rx="3" /><path d="M17 11h4v4h-4a2 2 0 0 1 0-4ZM7 9h7" />',
  wifi:
    '<path d="M2.7 8.6C7.8 4.2 16.2 4.2 21.3 8.6" /><path d="M6.4 12.1c3.2-2.7 8-2.7 11.2 0" /><path d="M10 15.7c1.1-.8 2.9-.8 4 0" /><path d="M12 19h.01" />',
};

export function icon(name, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? ""}</svg>`;
}

export function cartIcon(className = "") {
  return `
    <svg class="${className}" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M6 8h5l5.2 23.2a4 4 0 0 0 3.9 3.1h16.5a4 4 0 0 0 3.8-2.8l4.1-13.7H15" />
      <path d="M19 41.5h.01M36 41.5h.01" />
      <circle cx="19" cy="41.5" r="2.6" />
      <circle cx="36" cy="41.5" r="2.6" />
    </svg>
  `;
}
