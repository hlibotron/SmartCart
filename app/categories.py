from dataclasses import dataclass
import re


@dataclass(frozen=True)
class ProductCategory:
    key: str
    name: str
    icon: str
    color: str
    color_soft: str
    aliases: tuple[str, ...]
    keywords: tuple[str, ...]


PRODUCT_CATEGORIES = {
    "dairy": ProductCategory(
        key="dairy",
        name="Молочні",
        icon="milk",
        color="#16a34a",
        color_soft="#eaf8ef",
        aliases=("молочні", "молочні продукти", "dairy", "milk products"),
        keywords=("мол", "йогур", "сир", "сметан", "кефір", "кефир", "верш"),
    ),
    "meat": ProductCategory(
        key="meat",
        name="М'ясні",
        icon="meat",
        color="#b45309",
        color_soft="#fff1df",
        aliases=("м'ясні", "м'ясо", "ковбаси", "meat"),
        keywords=("м'яс", "кур", "ковбас", "фарш", "філе", "филе", "сосиск", "шинка"),
    ),
    "vegetables": ProductCategory(
        key="vegetables",
        name="Овочі",
        icon="carrot",
        color="#f7c948",
        color_soft="#fff6d9",
        aliases=("овочі", "овоч", "vegetables"),
        keywords=("морк", "картоп", "томат", "помід", "огір", "огур", "капуст", "цибул"),
    ),
    "fruits": ProductCategory(
        key="fruits",
        name="Фрукти",
        icon="grapes",
        color="#a678e8",
        color_soft="#f1e9ff",
        aliases=("фрукти", "фрукт", "fruit", "fruits"),
        keywords=(
            "яблу",
            "банан",
            "виноград",
            "цитрус",
            "апельс",
            "мандар",
            "груш",
            "грейп",
            "лимон",
        ),
    ),
    "drinks": ProductCategory(
        key="drinks",
        name="Напої",
        icon="bottle",
        color="#2563eb",
        color_soft="#e8f2ff",
        aliases=("напої", "напитки", "drinks", "beverage", "beverages"),
        keywords=("вода", "сік", "сок", "кава", "кофе", "чай", "нап", "кола", "лимонад"),
    ),
    "grocery": ProductCategory(
        key="grocery",
        name="Бакалія",
        icon="jar",
        color="#6b7280",
        color_soft="#f1f2f4",
        aliases=("бакалія", "крупи", "макарони", "консерви", "grocery"),
        keywords=(
            "круп",
            "макарон",
            "борош",
            "мука",
            "цукор",
            "сахар",
            "консерв",
            "рис",
            "греч",
            "сухар",
            "хліб",
            "хлеб",
        ),
    ),
    "other": ProductCategory(
        key="other",
        name="Інше",
        icon="info",
        color="#64748b",
        color_soft="#f1f5f9",
        aliases=("інше", "iнше", "other", "unknown"),
        keywords=(),
    ),
}


def normalize_category_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.lower().strip()
    normalized = normalized.replace("’", "'").replace("`", "'").replace("ʼ", "'")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def get_category(key: str | None) -> ProductCategory:
    return PRODUCT_CATEGORIES.get(key or "", PRODUCT_CATEGORIES["other"])


def normalize_category(
    category: str | None,
    *,
    raw_name: str | None = None,
    item_name: str | None = None,
    product_category: str | None = None,
) -> ProductCategory:
    category_candidates = [
        normalize_category_text(product_category),
        normalize_category_text(category),
    ]
    fallback_category = PRODUCT_CATEGORIES["other"]

    for candidate in category_candidates:
        if not candidate:
            continue
        if candidate in PRODUCT_CATEGORIES:
            matched_category = PRODUCT_CATEGORIES[candidate]
            if matched_category.key == "other":
                fallback_category = matched_category
                continue
            return matched_category
        for product_category_item in PRODUCT_CATEGORIES.values():
            aliases = {normalize_category_text(alias) for alias in product_category_item.aliases}
            if candidate == normalize_category_text(product_category_item.name) or candidate in aliases:
                if product_category_item.key == "other":
                    fallback_category = product_category_item
                    continue
                return product_category_item

    product_text = normalize_category_text(f"{raw_name or ''} {item_name or ''}")
    if product_text:
        for product_category_item in PRODUCT_CATEGORIES.values():
            if any(keyword in product_text for keyword in product_category_item.keywords):
                return product_category_item

    return fallback_category


def category_payload(category: ProductCategory) -> dict[str, str]:
    return {
        "key": category.key,
        "name": category.name,
        "color": category.color,
        "colorSoft": category.color_soft,
        "icon": category.icon,
    }
