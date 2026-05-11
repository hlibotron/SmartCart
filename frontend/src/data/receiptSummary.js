export const receiptSummary = {
  store: "Сільпо",
  logo: "silpo",
  logoText: "Сільпо",
  dateTime: "09 травня 2025 · 12:35",
  status: "Чек успішно розпізнано",
  statusBadge: "Скан завершено",
  total: "₴486",
  stats: [
    {
      value: "23",
      label: "товари",
      icon: "basket",
    },
    {
      label: "Знижки:",
      value: "₴38",
      icon: "tag",
    },
    {
      label: "Потенційний кешбек:",
      value: "₴12.40",
      icon: "refresh",
    },
  ],
  totals: [
    {
      label: "Разом",
      value: "₴486",
    },
    {
      label: "Загальна знижка",
      value: "₴38",
    },
    {
      label: "Кешбек магазину",
      value: "₴3.20",
    },
    {
      label: "Кешбек SmartCart",
      value: "₴9.20",
    },
  ],
  expectedCashback: {
    label: "Очікуваний сумарний кешбек",
    value: "₴12.40",
  },
};

export const receiptFilters = [
  {
    key: "all",
    label: "Усі",
    active: true,
  },
  {
    key: "discount",
    label: "Зі знижкою",
  },
  {
    key: "store-cashback",
    label: "Кешбек магазину",
  },
  {
    key: "smartcart-cashback",
    label: "Кешбек SmartCart",
  },
];

export const receiptItems = [
  {
    name: "Молоко 2.5%",
    thumbnail: "milk",
    quantity: "2 шт",
    unitPrice: "₴24.90/шт",
    total: "₴49.80",
    discount: "₴4.00",
    storeCashback: "₴0.50",
    storeCashbackLabel: "1%",
    smartCartCashback: "+₴2.50",
  },
  {
    name: "Йогурт грецький",
    thumbnail: "yogurt",
    quantity: "1 шт",
    unitPrice: "₴28.00/шт",
    total: "₴28.00",
    discount: null,
    storeCashback: null,
    smartCartCashback: "+₴4.20",
  },
  {
    name: "Кава мелена",
    thumbnail: "coffee",
    quantity: "1 шт",
    unitPrice: "₴94.00/шт",
    total: "₴94.00",
    discount: "₴6.00",
    storeCashback: "₴1.88",
    storeCashbackLabel: "2%",
    smartCartCashback: "+₴3.80",
  },
  {
    name: "Банани",
    thumbnail: "banana",
    quantity: "1.25 кг",
    unitPrice: "₴61.04/кг",
    total: "₴76.30",
    discount: null,
    storeCashback: null,
    smartCartCashback: null,
  },
  {
    name: "Сир твердий",
    thumbnail: "cheese",
    quantity: "0.45 кг",
    unitPrice: "₴275.33/кг",
    total: "₴123.90",
    discount: "₴8.50",
    storeCashback: null,
    smartCartCashback: "+₴1.90",
  },
];
