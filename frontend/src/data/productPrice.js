export const selectedProduct = {
  name: "Молоко 2.5%",
  description: "Пастеризоване, 900 мл",
  price: "₴24.90",
  badge: "Краща ціна сьогодні",
  thumb: "milk",
};

export const pricePeriods = [
  { key: "1w", label: "1 тиж" },
  { key: "2w", label: "2 тиж" },
  { key: "1m", label: "1 міс", active: true },
  { key: "3m", label: "3 міс" },
];

export const priceChart = {
  title: "Динаміка ціни за 1 шт, ₴",
  yTicks: [20, 22, 24, 26, 28, 30, 32],
  xLabels: ["10 квіт", "17 квіт", "24 квіт", "1 трав", "8 трав"],
};

export const priceSeries = [
  {
    store: "Сільпо",
    color: "#f97316",
    values: [30.0, 29.3, 30.2, 30.0, 29.3, 30.0, 30.2, 29.9, 31.0, 31.5],
  },
  {
    store: "АТБ",
    color: "#0f4c92",
    values: [27.8, 27.2, 28.0, 28.0, 27.2, 27.6, 28.0, 27.8, 28.6, 28.2],
  },
  {
    store: "Novus",
    color: "#16a34a",
    values: [25.8, 25.2, 26.1, 26.1, 25.2, 25.3, 25.9, 25.6, 26.7, 26.3],
  },
  {
    store: "Ашан",
    color: "#ef1212",
    values: [22.2, 21.9, 22.6, 22.7, 21.9, 22.3, 22.5, 22.2, 23.2, 23.3],
  },
];

export const storePrices = [
  {
    name: "Сільпо",
    logo: "silpo",
    logoText: "Сільпо",
    price: "₴29.90",
    change: "+0.90",
    changeDirection: "up",
  },
  {
    name: "АТБ",
    logo: "atb",
    logoText: "АТБ",
    price: "₴24.90",
    change: "-0.30",
    changeDirection: "down",
  },
  {
    name: "Novus",
    logo: "novus",
    logoText: "NOVUS",
    price: "₴26.50",
    change: "-0.20",
    changeDirection: "down",
  },
  {
    name: "Ашан",
    logo: "auchan",
    logoText: "Ашан",
    price: "₴22.90",
    change: "-0.40",
    changeDirection: "down",
  },
];

export const productPriceInsight = {
  title: "Найнижча середня ціна — АТБ",
  text: "За останній місяць АТБ пропонує найкращі ціни на цей товар.",
};
