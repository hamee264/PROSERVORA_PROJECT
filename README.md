# NaijaFix

NaijaFix is a service marketplace for connecting customers with trusted
service providers across Nigeria.

Customers can discover services, create requests, communicate with providers,
book work, pay securely, and leave reviews. Providers can manage their
profiles and services, respond to marketplace and direct requests, manage
bookings, track earnings, and request payouts.

## Features

### Customer workspace

- Browse and search services
- Create general or provider-targeted service requests
- Compare provider applications and accept work
- Schedule booking sessions
- Message providers and receive notifications
- Pay for bookings through Paystack
- Confirm completed work and submit reviews

### Provider workspace

- Create a professional profile and publish services
- Browse marketplace jobs separately from direct requests
- Apply for jobs and manage accepted bookings
- Schedule and view booking sessions
- Message customers and track job progress
- Manage bank-account verification, earnings, and payout requests
- View ratings and customer reviews

### Platform services

- JWT authentication and role-based authorization
- PostgreSQL persistence with startup migrations
- Paystack payments, refunds, and payout transfers
- SMTP transactional email and verification messages
- Cloudinary media uploads
- Notifications, messaging, reviews, and dispute/refund flows
- Rate limiting and request validation

## Technology

- **Client:** React, React Router, Vite, JavaScript, CSS
- **Server:** Node.js, Express
- **Database:** PostgreSQL
- **Integrations:** Paystack, Cloudinary, SMTP

## Repository structure

```text
proservora/
├── client/                 # React/Vite customer and provider application
│   ├── src/components/
│   ├── src/pages/
│   ├── src/routes/
│   └── src/services/
├── server/                 # Express API and database migrations
│   ├── src/controllers/
│   ├── src/routes/
│   ├── src/services/
│   ├── src/config/
│   └── database/migrations/
└── README.md
```

The Admin application is being rebuilt separately and is intentionally not
covered by the current client and core-server setup instructions.

## Requirements

- Node.js 20 or newer
- PostgreSQL
- Paystack account and API keys
- SMTP mailbox
- Cloudinary account for media uploads

## Local setup

Install dependencies in both applications:

```bash
cd client
npm install

cd ../server
npm install
```

Create `server/.env` with the database, authentication, payment, email, and
upload settings required by the server. At minimum, startup requires:

```dotenv
PORT=3000
NODE_ENV=development
DB_USER=postgres
DB_HOST=localhost
DB_NAME=naijafix
DB_PASSWORD=your-password
DB_PORT=5432
JWT_SECRET=replace-with-a-long-random-secret
PAYSTACK_SECRET_KEY=your-paystack-secret-key
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-mailbox
SMTP_PASS=your-mailbox-password
EMAIL_FROM="NaijaFix <no-reply@example.com>"
```

Add the Cloudinary and application URL variables used by the deployment
environment as well. Never commit `.env` files or real credentials.

Start the API:

```bash
cd server
node server.js
```

The server runs pending database migrations during startup. Start the client
in a second terminal:

```bash
cd client
npm run dev
```

The Vite development server will print the local URL when it starts.

## Client commands

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

## Server validation

The server currently uses syntax checks and focused scripts for validation.
From the repository root, a quick syntax check for the core server files is:

```bash
find server/src -name '*.js' -print0 | xargs -0 -n1 node --check
node --check server/server.js
```

Before deploying, test the complete payment, email, upload, payout, and
database flows with production-like credentials and webhook configuration.

## Security notes

- Keep all secrets in environment variables.
- Use Paystack test keys and mock transfers only in development.
- Configure Paystack webhook endpoints with signature verification.
- Use HTTPS and secure production database credentials.
- Do not commit generated archives, local database files, or test credentials.
