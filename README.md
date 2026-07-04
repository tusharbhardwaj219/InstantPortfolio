# Instant Portfolio

Turn a resume (PDF/DOCX) into a shareable developer portfolio website.

```
resume/
├── backend/            Express + Prisma (MongoDB) API
│   ├── prisma/         schema.prisma (User, Resume, Portfolio, …)
│   └── src/
│       ├── config/     env validation, Prisma client
│       ├── controllers/routes/services/  layered API
│       ├── middleware/ auth (JWT), upload (multer), validation (zod), errors
│       └── utils/      jwt, logger, responses, slugs
└── frontend/           static site (no build step)
    ├── index.html      landing page + generator flow
    ├── portfolio.html  public portfolio page (premium template)
    ├── login.html / signup.html
    ├── js/api.js       shared API client (auth, upload SSE, portfolio)
    ├── js/portfolio.js portfolio renderer
    └── css/portfolio.css
```

## Setup

1. **Configure** `backend/.env`:
   - `DATABASE_URL` — replace `<db_password>` with your Atlas password.
     The URL **must** contain a database name (e.g. `/instantportfolio`) before `?`.
   - `JWT_SECRET` — set a random 32+ char secret (`openssl rand -hex 32`).

2. **Install & run the backend** (serves the frontend too):
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push       # first run only
   npm run dev
   ```

3. Open **http://localhost:5000** — the Express server serves the static
   frontend and the API from the same origin.

## Flow

1. Sign up / log in (`/api/auth`) — JWT stored in localStorage.
2. Upload a resume on the landing page — streamed to `/api/resume/upload`
   (multipart + SSE progress), parsed server-side, portfolio generated.
3. Manual corrections from the details form are applied via `PUT /api/portfolio/:id`.
4. Share the public page: `http://localhost:5000/p/<slug>` — rendered by
   `portfolio.html`, which fetches `/api/portfolio/public/:slug`.
5. If the backend is unreachable or the visitor is not logged in, the frontend
   falls back to a fully client-side preview (localStorage) so the demo still works.

## Docker

```bash
cd backend
docker compose up --build
```
