# GistDB

Таблицы в GitHub Gists — редактируй и делись ссылкой мгновенно.

## Как это работает

- Каждая «база данных» — это один **GitHub Gist** (приватный JSON-файл)
- Ссылка для просмотра: `https://ваш-сайт.com/db/<ID гиста>` — открывается без авторизации
- Редактирование — только с GitHub PAT-токеном (вводится один раз, хранится в localStorage)
- Листов в базе — сколько нужно; названия строк и колонок — произвольные

## Запуск локально

```bash
npm install
npm run dev
```

Открой: http://localhost:5173

## Деплой на Vercel (рекомендуется)

1. Залогинься на vercel.com
2. Import → выбери репозиторий
3. Framework: Vite, всё остальное по умолчанию
4. Deploy

## Деплой на GitHub Pages

Установи gh-pages:
```bash
npm install -D gh-pages
```

Добавь в package.json:
```json
"homepage": "https://<username>.github.io/gistdb",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

Задеплой:
```bash
npm run deploy
```

Создай public/404.html (скопируй index.html) — нужно для SPA-роутинга на GitHub Pages.

## Получить GitHub PAT-токен

https://github.com/settings/tokens/new?scopes=gist&description=GistDB

Выбери scope: gist (read+write).

## Формат данных

```json
{
  "name": "Мой каталог",
  "sheets": [
    {
      "id": "uuid",
      "name": "Лист 1",
      "cols": ["Название", "Цена"],
      "rows": [["Яблоко", "50"]],
      "rowLabels": ["Строка 1"]
    }
  ]
}
```
