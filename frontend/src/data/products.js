export const frequentProducts = [
  { name: "Молоко 2.5%", thumb: "milk", active: true },
  { name: "Йогурт грецький", thumb: "yogurt" },
  { name: "Яйця 10 шт", thumb: "eggs" },
  { name: "Кава мелена", thumb: "coffee" },
  { name: "Банани 1 кг", thumb: "banana" },
  { name: "Сир твердий", thumb: "cheese" },
];

export const productStats = [
  { label: "Відстежуються", value: "18", icon: "trendUp" },
  { label: "Зниження цін", value: "5", icon: "arrowDown" },
  { label: "Кешбек", value: "3", icon: "cashback" },
];

export const productFilters = [
  { key: "all", label: "Усі", active: true },
  { key: "frequent", label: "Часто купую" },
  { key: "cashback", label: "Є кешбек" },
  { key: "discount", label: "Знижки" },
];

export const products = [
  {
    name: "Молоко 2.5%",
    thumb: "milk",
    description: "Пастеризоване, 900 мл",
    frequency: "купую 4 рази/міс",
    price: "₴24.90",
    store: "АТБ",
    trend: "-0.30 за тиждень",
    badge: "+ кешбек",
    badgeType: "cashback",
  },
  {
    name: "Йогурт грецький",
    thumb: "yogurt",
    description: "150 г",
    frequency: "купую 3 рази/міс",
    price: "₴28.00",
    store: "Novus",
    trend: "-0.20 за тиждень",
  },
  {
    name: "Кава мелена",
    thumb: "coffee",
    description: "250 г",
    frequency: "купую 2 рази/міс",
    price: "₴94.00",
    store: "Ашан",
    trend: "-1.00 за тиждень",
    badge: "знижка",
    badgeType: "discount",
  },
  {
    name: "Банани",
    thumb: "banana",
    description: "1 кг",
    frequency: "купую 4 рази/міс",
    price: "₴61.04/кг",
    store: "Novus",
    trend: "-2.10 за тиждень",
  },
  {
    name: "Сир твердий",
    thumb: "cheese",
    description: "1 кг",
    frequency: "купую 1 раз/міс",
    price: "₴275.33/кг",
    store: "Сільпо",
    trend: "-3.20 за тиждень",
    badge: "+ кешбек",
    badgeType: "cashback",
  },
];

export const dailyRecommendation = {
  title: "Рекомендація дня",
  text: "Молоко дешевше в АТБ — економія ₴5.00",
};
