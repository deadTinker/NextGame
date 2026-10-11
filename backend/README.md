# NextQuest API (Express + PostgreSQL)

This starter provides email/password accounts and a per-user cloud save for the current game, checklist, completed games, ratings, and reviews.

## Requirements
- Node.js 20+
- PostgreSQL 14+

## 1. Create the database
Create a database named `nextquest` in PostgreSQL, for example:

```sql
CREATE DATABASE nextquest;
```

Then run `sql/schema.sql` against that database using pgAdmin's Query Tool or `psql`.

## 2. Configure the backend
From this folder:

```bash
npm install
```

Copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `JWT_SECRET` (at least 32 characters). Keep `.env` private and do not commit it.

## 3. Start the API

```bash
npm run dev
```

Check `http://localhost:4000/api/health`; a healthy response looks like `{"ok":true,"database":"connected"}`.

## API routes
- `POST /api/auth/signup` with `{ "email", "password" }`
- `POST /api/auth/login` with `{ "email", "password" }`
- `GET /api/sync` with `Authorization: Bearer <token>`
- `PUT /api/sync` with `Authorization: Bearer <token>` and `{ "state": { "activeGame", "tasks", "completedGames" } }`

The sync endpoint is account-scoped: the user ID comes from the verified token, never from the request body. The initial implementation stores the user's save as JSONB to keep the app integration straightforward. It is a starter, not a production deployment; before launch, configure TLS, production CORS origins, backups, and a managed PostgreSQL service.
