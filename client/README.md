# Proservora client

This directory contains the React/Vite customer and provider application for
Proservora, a service marketplace connecting customers with service
providers.

## Development

From this directory:

```bash
npm install
npm run dev
```

The Vite development server prints the local URL when it starts.

## Available commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

## Application areas

- Customer discovery, requests, bookings, payments, messaging, and reviews
- Provider jobs, direct requests, bookings, earnings, payouts, and reviews
- Shared authentication, notifications, layouts, and API services

The API is maintained in the sibling [`server`](../server) directory. See the
repository [README](../README.md) for the complete setup and environment
configuration.

## Netlify deployment

Create a Netlify site from this repository with:

```text
Base directory: client
Build command: npm run build
Publish directory: client/dist
```

Set this environment variable in Netlify:

```text
VITE_API_URL=https://your-deployed-api.example.com/api
```

The `VITE_API_URL` value must point to the deployed Proservora API. The
frontend falls back to `http://localhost:3000/api` only for local development.
The `public/_redirects` file keeps client-side routes working after a browser
refresh.
