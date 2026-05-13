# ТЗ: Fallback-зображення товарів у підсумку сканованого чеку

## 1. Проблема

Коли клієнт сканує чек і переходить на підсумок чеку, у списку товарів може бути товар, для якого в базі немає фото або конкретного візуального прев'ю. Через це товар може відображатися некоректно, порожнім блоком або з невідповідною іконкою.

Поточна реалізація використовує поле `thumbnail` як короткий тип прев'ю (`milk`, `yogurt`, `coffee`, `banana`, `cheese` тощо), а frontend малює CSS-іконку через клас `receipt-item-thumb--{thumbnail}`. Це працює для відомих товарів, але не дає надійного fallback для всіх категорій і майбутніх реальних фото.

## 2. Мета

Забезпечити стабільне відображення кожного товару в підсумку чеку незалежно від того, чи є фото товару в базі.

Користувач завжди має бачити:

- реальне фото товару, якщо воно є;
- fallback-зображення категорії, якщо фото товару немає;
- універсальний fallback `Інше`, якщо категорію теж не вдалося визначити.

## 3. Найкраще рішення

Реалізувати двошаровий механізм зображень:

1. **Product image**: реальне фото конкретного товару, якщо воно є в базі.
2. **Category fallback image**: дефолтне зображення або іконка категорії, якщо фото товару відсутнє.
3. **Generic fallback image**: дефолт для категорії `Інше`, якщо немає ні фото, ні зрозумілої категорії.

Для MVP не потрібно шукати фото товарів в інтернеті або генерувати їх через AI. Це дасть нестабільність, юридичні ризики з правами на зображення і повільніший UX. Краще використати контрольований набір локальних fallback assets для категорій.

## 4. Обсяг робіт

### Входить в задачу

- Додати backend-логіку вибору зображення товару.
- Повернути у payload підсумку чеку структуроване поле для зображення.
- Додати дефолтні assets або CSS-іконки для всіх canonical категорій.
- Забезпечити fallback для товарів без фото.
- Забезпечити fallback для невідомих категорій.
- Не ламати існуючий `thumbnail` контракт одразу, якщо frontend ще його використовує.

### Не входить в задачу

- Автоматичний пошук фото товарів у зовнішніх джерелах.
- AI-генерація фото для кожного товару.
- Повна адмін-панель керування фото товарів.
- Масове наповнення бази реальними продуктовими фото.

## 5. Вимоги до даних

### 5.1. Product

Рекомендовано додати в модель `Product` поля:

- `image_url`: URL реального фото товару, nullable.
- `image_source`: джерело фото, nullable. Наприклад: `manual`, `store_catalog`, `generated`, `fallback`.
- `image_updated_at`: дата оновлення фото, nullable.

Для MVP можна не робити міграцію під `image_url`, якщо зараз немає реальних фото. Але API має бути спроєктований так, щоб це поле легко додати пізніше.

### 5.2. Category

У довіднику категорій має бути fallback-візуал:

- `fallbackImageUrl` або `fallbackThumb`;
- `icon`;
- `color`;
- `colorSoft`.

Приклад:

| Category key | UI назва | Fallback thumb | Fallback asset |
| --- | --- | --- | --- |
| `dairy` | Молочні | `milk` | `/assets/category-fallbacks/dairy.svg` |
| `meat` | М'ясні | `meat` | `/assets/category-fallbacks/meat.svg` |
| `vegetables` | Овочі | `carrot` | `/assets/category-fallbacks/vegetables.svg` |
| `fruits` | Фрукти | `grapes` | `/assets/category-fallbacks/fruits.svg` |
| `drinks` | Напої | `bottle` | `/assets/category-fallbacks/drinks.svg` |
| `grocery` | Бакалія | `jar` | `/assets/category-fallbacks/grocery.svg` |
| `other` | Інше | `info` | `/assets/category-fallbacks/other.svg` |

## 6. Backend-вимоги

### 6.1. Функція вибору зображення

Додати backend helper:

```python
def product_visual_payload(product, item) -> dict:
    ...
```

Логіка:

1. Якщо `product.image_url` існує, повернути реальне фото.
2. Інакше визначити canonical category через `normalize_category`.
3. Повернути fallback категорії.
4. Якщо категорія невідома, повернути fallback `other`.

### 6.2. API response для підсумку чеку

У `receipt_detail_payload()` для кожного item додати поле `visual`.

Очікуваний формат:

```json
{
  "name": "Молоко 2.5%",
  "thumbnail": "milk",
  "visual": {
    "type": "category-fallback",
    "url": null,
    "thumb": "milk",
    "categoryKey": "dairy",
    "alt": "Молочні"
  },
  "quantity": "1 шт",
  "unitPrice": "₴42.00/шт",
  "total": "₴42.00"
}
```

Для товару з реальним фото:

```json
{
  "visual": {
    "type": "product-image",
    "url": "/uploads/products/milk-galychyna.webp",
    "thumb": "milk",
    "categoryKey": "dairy",
    "alt": "Молоко 2.5%"
  }
}
```

Поле `thumbnail` лишити для backward compatibility, але новий frontend має орієнтуватися на `visual`.

### 6.3. Місця підключення

Оновити:

- `receipt_detail_payload()` для `/api/receipts/{id}` і `/api/receipts/latest`;
- `/api/products`, якщо картки товарів також мають показувати реальне фото або fallback;
- `/api/products/{product_name}/prices`, якщо сторінка ціни товару має прев'ю.

### 6.4. Гарантія API

Backend ніколи не має повертати item без валідного visual fallback.

Мінімальна гарантія:

- `visual.type` завжди є;
- `visual.thumb` завжди є;
- `visual.categoryKey` завжди є;
- якщо `visual.url` відсутній, frontend використовує `visual.thumb`.

## 7. Frontend-вимоги

### 7.1. Компонент відображення товару

Оновити `renderProductThumb(item)` у `frontend/src/pages/receiptSummary.js`.

Логіка:

1. Якщо `item.visual.type === "product-image"` і `item.visual.url` існує, показати `<img>`.
2. Якщо фото не завантажилось або `url` порожній, показати fallback за `visual.thumb`.
3. Якщо `visual` відсутній через старий API, використовувати старе `item.thumbnail`.
4. Якщо немає ні `visual`, ні `thumbnail`, використовувати `other`.

### 7.2. CSS

Додати стилі для:

- `.receipt-item-thumb img`;
- `.receipt-item-thumb--meat`;
- `.receipt-item-thumb--carrot`;
- `.receipt-item-thumb--grapes`;
- `.receipt-item-thumb--bottle`;
- `.receipt-item-thumb--jar`;
- `.receipt-item-thumb--info`.

Зараз CSS має окремі стилі лише для частини thumbnail типів. Потрібно покрити всі типи, які backend може повернути.

### 7.3. Поведінка при помилці зображення

Для `<img>` додати fallback:

- при `onerror` приховати image;
- додати клас fallback thumbnail;
- показати CSS-іконку категорії.

Frontend не повинен показувати зламану іконку браузера.

## 8. UX-вимоги

- Усі товари в чеку мають мати однаковий за розміром preview-блок.
- Fallback має виглядати як свідомий елемент UI, а не як помилка.
- Для невідомих товарів показувати нейтральний preview `Інше`.
- Не показувати текст типу "немає фото" у списку товарів, бо це створює шум у підсумку чеку.
- Якщо пізніше буде екран деталей товару, там можна показувати статус "Фото товару ще не додано".

## 9. Acceptance criteria

- Якщо товар має `product.image_url`, у підсумку чеку показується реальне фото.
- Якщо товар не має `product.image_url`, але має категорію `Молочні`, показується fallback `milk`.
- Якщо товар не має фото і категорія `Напої`, показується fallback `bottle`.
- Якщо товар не має фото і категорія невідома, показується fallback `info` або `other`.
- Жоден товар у підсумку чеку не відображається з порожнім або зламаним preview.
- Старі дані з `thumbnail` продовжують працювати.
- Frontend build проходить без помилок.

## 10. Тестові сценарії

1. Сканований чек містить товар `Молоко`, фото в базі немає, категорія `Молочні`.
   Очікування: item має `visual.type = "category-fallback"`, `visual.thumb = "milk"`.

2. Сканований чек містить товар `Вода`, фото в базі немає, категорія визначена як `Напої`.
   Очікування: показується fallback `bottle`.

3. Сканований чек містить невідомий товар без категорії.
   Очікування: backend повертає `categoryKey = "other"` і fallback `info`.

4. Товар має `image_url`.
   Очікування: frontend показує `<img>`, а не CSS thumbnail.

5. `image_url` повертає 404 або не завантажується.
   Очікування: frontend автоматично переходить на category fallback.

6. API старої версії повертає тільки `thumbnail`.
   Очікування: frontend не падає і показує старий thumbnail.

## 11. Рекомендована послідовність реалізації

1. Розширити довідник категорій fallback thumbnail/asset значеннями.
2. Додати backend helper `product_visual_payload`.
3. Оновити response у `receipt_detail_payload`.
4. Оновити frontend `renderProductThumb`.
5. Додати CSS fallback для всіх категорій.
6. Додати smoke-тести або ручні сценарії для товарів без фото.
7. Пізніше, окремою задачею, додати `Product.image_url` і механізм ручного завантаження фото товару.

## 12. Рішення для MVP

Для поточного стану проєкту найкращий MVP:

- не додавати реальні фото товарів одразу;
- гарантувати category fallback через `thumbnail`;
- розширити CSS під всі canonical категорії;
- у backend завжди повертати `visual` і `thumbnail`;
- залишити `Product.image_url` як наступний етап.

Це швидко вирішує проблему з порожніми прев'ю після сканування чеку і не створює залежності від зовнішніх сервісів.
