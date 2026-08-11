# Happy Hair Store – Production

Clean Vercel-ready structure preserving the existing frontend while separating API, routes, controllers, middleware, Prisma and public assets.

## Required Vercel environment variables
- DATABASE_URL
- DIRECT_URL
- JWT_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- ALLOWED_ORIGINS
- RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (for automatic online payments)
- SHIPCORRECT_API_KEY / SHIPCORRECT_BASE_URL (for shipping)

Never commit real secrets to GitHub.

## Database
Run Prisma migrations against your PostgreSQL database, then run `npm run seed` once from a trusted environment with the production environment variables loaded.

## Payment
The current frontend redirects to `/api/payment/checkout/:orderId`. Configure Razorpay keys in Vercel for automatic payment checkout and server-side verification. Without Razorpay keys, the manual UPI flow remains available.
