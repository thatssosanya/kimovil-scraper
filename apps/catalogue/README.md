# Палач - Каталог

Внутренняя система управления каталогом устройств для сайта [Палач](https://click-or-die.ru) .

## Либы

- Next.js 14 + TypeScript + Tailwind CSS
- Авторизация через Clerk
- Современный UI на Radix UI
- tRPC

## Обзор

Инструмент для управления и организации рейтингов устройств и профилей с характеристиками.

### Новые возможности

#### Анализ комиссии AliExpress

Система теперь поддерживает анализ ссылок AliExpress с автоматической проверкой комиссионных ставок через API Admitad:

- **Автоматическое определение** ссылок AliExpress
- **Проверка комиссии** через официальный API Admitad
- **Отображение базовой комиссии** и комиссии для горячих товаров
- **Информация о статусе товара** (обычный/горячий)
- **Интеграция с партнерской программой** Admitad

Поддерживаемые форматы ссылок:

- `aliexpress.ru/item/...`
- `aliexpress.com/item/...`
- `s.click.aliexpress.com/...`
- `fas.st/...` (короткие ссылки AliExpress)

#### Extension API

Система предоставляет API для браузерных расширений:

**POST** `/api/extension/check-commission`

- Проверка комиссионных ставок AliExpress
- Требует `secret` и массив `urls`
- Возвращает данные о комиссии для каждой ссылки

**POST** `/api/extension/create-deeplinks`

- Создание партнерских deeplink'ов для AliExpress
- Требует `secret` и одну `url`
- Возвращает партнерскую ссылку

Пример запроса для проверки комиссии:

```json
{
  "secret": "your_extension_secret",
  "urls": ["https://aliexpress.ru/item/1005009062242176.html"]
}
```

Пример запроса для создания deeplink:

```json
{
  "secret": "your_extension_secret",
  "url": "https://aliexpress.ru/item/1005009062242176.html"
}
```

## Технологии

- Next.js 14
- TypeScript
- Tailwind CSS
- Clerk
- tRPC
- Drizzle + LibSQL
- Radix UI + Headless UI
- Zustand
- Uppy
- React Hook Form
- **admitad-api-client** (для работы с AliExpress)

## Начало работы

### Требования

- Node.js 22.13.1
- npm или bun
- Доступ к проекту в Clerk
- Доступ к базе данных LibSQL
- RabbitMQ 3.12+ (для функций скрапинга)

### Установка

1. Клонируем репозиторий

```bash
git clone [repository-url]
cd click-or-die-catalogue-stage
```

2. Устанавливаем зависимости

```bash
npm install
# или
bun install
```

3. Настраиваем переменные окружения

```bash
cp .env.example .env
# Заполняем необходимые переменные
```

4. Запускаем сервер разработки

```bash
npm run dev
# или
bun dev
```

Приложение будет доступно по адресу `http://localhost:3000`

## RabbitMQ

Для работы скрапинга требуется RabbitMQ. Сервис использует следующие очереди:

- getAutocompleteOptionsRequest
- getUserConfirmedSlugRequest
- getKimovilDataRequest
- getKimovilDataResponse
- errorResponse

Настройка RabbitMQ:

```bash
# Устанавливаем RabbitMQ
brew install rabbitmq # macOS
# или используем Docker
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

В .env необходимо указать:

```
RMQ_CONNSTR=amqp://localhost:5672
```

## Структура проекта

```
src/
├── assets/      # Статические файлы
├── components/  # React компоненты
├── hooks/       # React хуки
├── lib/         # Конфигурации
├── pages/       # Страницы Next.js
├── server/      # tRPC сервер
├── stores/      # Zustand сторы
├── styles/      # Стили
├── types/       # TypeScript типы
└── utils/       # Утилиты
```

## Переменные окружения

Обязательные переменные:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Публичный ключ Clerk
- `CLERK_SECRET_KEY`: Секретный ключ Clerk
- `DATABASE_URL`: URL базы данных LibSQL
- `RMQ_CONNSTR`: URL подключения к RabbitMQ

### Admitad API (для AliExpress)

Для работы с комиссиями AliExpress необходимо настроить:

- `ADMITAD_CLIENT_ID`: ID клиента из личного кабинета Admitad
- `ADMITAD_CLIENT_SECRET`: Секретный ключ из личного кабинета Admitad
- `ADMITAD_BASE64_AUTH`: (опционально) Готовый base64-encoded заголовок авторизации
- `ADMITAD_API_BASE_URL`: (опционально) URL API Admitad (по умолчанию: https://api.admitad.com)

#### Получение ключей Admitad

1. Войдите в личный кабинет издателя Admitad
2. Перейдите в настройки приложения
3. Нажмите "Показать учетные данные" для получения `client_id` и `client_secret`

### Extension API

Для работы Extension API необходимо настроить:

- `EXTENSION_SECRET`: Секретный ключ для аутентификации запросов от браузерных расширений

Дополнительные переменные в env.mjs

## Разработка

1. Создаём ветку для фичи
2. Вносим изменения
3. Создаём PR

## Поддержка

По всем вопросам: @RomanZagrebin в Telegram
