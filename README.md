# Happy Hair Store Production

Production-ready layout for the Happy Hair storefront and Express API.

## Structure
- `public/` — storefront assets
- `api/index.js` — Vercel Express entrypoint
- `routes/`, `controllers/`, `middlewares/` — backend
- `prisma/` — PostgreSQL schema and seed

## Required Vercel environment variables
See `.env.example`. Never commit real secrets.

## First tests after deployment
- `/`
- `/api/health`
- `/api/products`
