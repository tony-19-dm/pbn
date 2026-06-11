# Paint by Numbers — веб-приложение

Fullstack-приложение: React (клиент) + Node.js/Express (сервер) + MongoDB.

## Структура

```
pbn/
├── server/          # Node.js + Express + MongoDB
│   ├── src/
│   │   ├── index.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   └── Painting.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── paintings.js
│   │   │   └── users.js
│   │   └── middleware/
│   │       └── auth.js
│   ├── package.json
│   └── .env.example
└── client/          # React SPA
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   ├── algorithm.js      # весь алгоритм генерации
    │   ├── api/index.js      # все запросы к серверу
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── components/
    │   │   ├── Layout.js
    │   │   ├── Layout.css
    │   │   └── PaintingCard.js
    │   └── pages/
    │       ├── FeedPage.js
    │       ├── GeneratorPage.js
    │       ├── PaintingPage.js
    │       ├── FavoritesPage.js
    │       ├── LoginPage.js
    │       └── RegisterPage.js
    ├── public/index.html
    └── package.json
```

## Запуск

### 1. MongoDB
Убедитесь, что MongoDB запущена локально:
```bash
mongod
# или через systemd:
sudo systemctl start mongod
```

### 2. Сервер
```bash
cd server
npm install
cp .env.example .env
# Отредактируйте .env — установите JWT_SECRET
npm run dev
# Сервер запустится на http://localhost:5000
```

### 3. Клиент
```bash
cd client
npm install
npm start
# Откроется http://localhost:3000
```

## API

| Метод  | Путь                          | Auth | Описание                        |
|--------|-------------------------------|------|---------------------------------|
| POST   | /api/auth/register            | —    | Регистрация                     |
| POST   | /api/auth/login               | —    | Вход                            |
| GET    | /api/auth/me                  | ✓    | Текущий пользователь            |
| GET    | /api/paintings                | —    | Лента (поиск: ?search=&page=)   |
| GET    | /api/paintings/:id            | —    | Раскраска с SVG                 |
| POST   | /api/paintings                | ✓    | Опубликовать раскраску          |
| DELETE | /api/paintings/:id            | ✓    | Удалить свою раскраску          |
| POST   | /api/paintings/:id/favorite   | ✓    | Добавить/убрать из избранного   |
| GET    | /api/users/:id/paintings      | —    | Публикации пользователя         |
| GET    | /api/users/me/favorites       | ✓    | Моё избранное                   |

## Переменные окружения (.env)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/paintbynumbers
JWT_SECRET=замените_на_случайную_строку
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```
