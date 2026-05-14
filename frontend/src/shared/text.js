const productUnits = [
  "кг",
  "мг",
  "мл",
  "шт",
  "уп",
  "л",
  "г",
];

const unitPattern = new RegExp(`(\\d+(?:[,.]\\d+)?)\\s*(${productUnits.join("|")})(?=$|[^\\p{L}])`, "giu");

function isUppercaseToken(token) {
  const letters = token.match(/\p{L}/gu) || [];
  if (letters.length < 2) {
    return false;
  }

  return letters.every((letter) => letter === letter.toLocaleUpperCase("uk-UA"));
}

function titleCaseToken(token) {
  return token.replace(/\p{L}+/gu, (word) => {
    if (word.length < 2) {
      return word.toLocaleUpperCase("uk-UA");
    }

    return `${word[0].toLocaleUpperCase("uk-UA")}${word.slice(1).toLocaleLowerCase("uk-UA")}`;
  });
}

export function formatProductText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  return text
    .replace(unitPattern, (_, amount, unit) => `${amount}${unit.toLocaleLowerCase("uk-UA")}`)
    .replace(/[\p{L}][\p{L}'’.-]*/gu, (token) =>
      isUppercaseToken(token) ? titleCaseToken(token) : token,
    );
}
