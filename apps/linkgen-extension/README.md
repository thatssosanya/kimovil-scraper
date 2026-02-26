# LinkGen Chrome Extension

Генератор партнерских ссылок для Яндекс.Маркет, AliExpress и Price.ru.

Приложение теперь живет внутри монорепозитория `cod` как workspace:
`apps/linkgen-extension`.

## Функции

### Яндекс.Маркет
- Автоматическое определение товаров
- Генерация ссылок для сайта и Telegram
- Поддержка разных авторов (VID)
- Особая логика для пользователя "Кик" (единая ссылка)
- Кэширование ссылок
- Автообновление страницы для получения card-формата
- Поиск карточек по запросу (например `iPhone 17 Pro`) через scraper WS (`yandex.searchLinks`)
- Отображение цены и реферального бонуса в результатах поиска

### AliExpress  
- Проверка комиссий через API
- Генерация партнерских deeplink'ов
- Отображение "горячих" товаров
- Предупреждение о нулевой комиссии
- Кнопка обновления комиссии

### Price.ru
- Генерация партнерских ссылок с UTM-параметрами
- Автоматическое добавление erid параметра

## Установка

```bash
# Из корня монорепы
npm install

# Разработка extension
npm run dev --workspace=apps/linkgen-extension

# Сборка extension
npm run build --workspace=apps/linkgen-extension

# Проверка типов
npm run check-types --workspace=apps/linkgen-extension

# Линт
npm run lint --workspace=apps/linkgen-extension

# Тесты
npm run test --workspace=apps/linkgen-extension
```

## Переменные окружения

Создайте `apps/linkgen-extension/.env`:

```bash
# Локальный scraper backend (REST)
VITE_SCRAPER_API_URL=http://localhost:1488
```

Для прода можно указать:

```bash
VITE_SCRAPER_API_URL=https://api.click-or-die.ru
```

По умолчанию используется `http://localhost:1488`.

## Загрузка в браузер

1. Соберите расширение: `npm run build --workspace=apps/linkgen-extension`
2. Откройте `chrome://extensions/`
3. Включите "Режим разработчика"
4. "Загрузить распакованное расширение" → выберите папку `apps/linkgen-extension/dist`

## Горячие клавиши

- `Alt+G` - Генерировать ссылки
- `Alt+C` - Копировать ссылку для сайта
- `Alt+T` - Копировать ссылку для Telegram
- `Alt+R` - Проверить комиссию AliExpress

## Структура проекта

```
src/
├── pages/
│   ├── background/     # Service worker
│   └── sidepanel/      # Основной UI
│       ├── components/ # UI компоненты
│       └── hooks/      # React хуки
├── services/
│   └── LinkService.ts  # Логика генерации ссылок
└── shared/
    ├── storages/       # Chrome storage
    └── utils/          # Парсеры URL и API клиенты
```

## Технологии

- React 18 + TypeScript
- Vite
- Tailwind CSS (Twind)
- Chrome Extension Manifest V3
- Vitest
