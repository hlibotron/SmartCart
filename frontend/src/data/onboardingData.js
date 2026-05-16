export const onboardingSteps = [
  {
    step: "1/3",
    title: "Розумні покупки\nпочинаються з чека",
    description:
      "Скануйте чеки — отримуйте аналітику, порівнюйте ціни та повертайте кешбек",
    type: "intro",
  },
  {
    step: "2/3",
    title: "Оберіть вашу локацію",
    description: "Щоб показувати актуальні ціни поруч з вами",
    type: "location",
    cities: ["Київ", "Львів", "Дніпро", "Одеса", "Харків"],
  },
  {
    step: "3/3",
    title: "Дозвольте доступ,\nщоб працювало краще",
    type: "permissions",
    permissions: [
      { title: "Камера", description: "Щоб сканувати чеки", icon: "camera" },
      {
        title: "Геолокація",
        description: "Щоб знаходити магазини поруч і актуальні ціни",
        icon: "mapPin",
      },
      {
        title: "Сповіщення",
        description: "Щоб не пропускати кешбек та вигідні пропозиції",
        icon: "bell",
      },
    ],
  },
];
