# ReLoop — Marketplace for Second-Hand Items

A full-stack peer-to-peer marketplace for buying and selling used goods, built as a Full Stack Web Development internship project.

## Stack

- **Frontend:** HTML, CSS, vanilla JavaScript (no framework — multi-page app)
- **Backend:** Node.js + Express (REST API)
- **Database:** SQLite (via `better-sqlite3`) — a single file, zero setup
- **Auth:** Session cookies + bcrypt password hashing
- **File uploads:** Multer (listing photos)

## Features implemented

**Core deliverables**
- Item listing form with photo upload, category, condition, price, location
- Buyer search with filters (keyword, category, price range, location)
- In-app messaging between buyers and sellers, scoped per listing
- Secure "payment" with escrow + buyer protection (see note on payments below)

**Advanced features**
- Price negotiation: buyers make offers, sellers can counter, accept, or reject
- Verified seller badge (`is_verified` flag + one-click demo verification)
- Standardized condition options (like new / good / fair / needs repair)
- Wishlist + saved-search alerts (new listings can be checked against saved searches)
- Local pickup option alongside delivery/shipping at checkout
- Admin-mediated dispute resolution (release funds / refund / partial refund)
- Carbon footprint estimate shown on every listing (illustrative kg CO₂ saved by category)
- Social sharing buttons (WhatsApp, Facebook, Instagram) on listing pages
- Mobile-responsive layout
- Admin analytics dashboard (listings, users, GMV, open disputes, category breakdown)
- Instant seller payout on buyer-confirmed receipt

### A note on payments

This project runs in a sandboxed environment with no access to the real Stripe API or the public internet for payment processors. `backend/routes/payments.js` simulates a Stripe Checkout + Connect escrow flow end-to-end — charge, hold in escrow, release on confirmed receipt, refund on dispute — so every other part of the app (buyer protection, instant payout, disputes) behaves exactly as it would with Stripe wired in. To go live, replace `fakeChargeCard()` with a real `stripe.paymentIntents.create()` call and add Stripe Connect for seller payouts. Everything else — the database records, the dashboard, the dispute flow — is real and functional.

## Project structure

```
marketplace/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── db.js               # SQLite schema + seed data
│   ├── middleware/auth.js  # session auth guards
│   ├── routes/
│   │   ├── auth.js         # register, login, logout, verify
│   │   ├── listings.js     # CRUD + search/filter
│   │   ├── offers.js       # negotiation
│   │   ├── messages.js     # buyer/seller chat
│   │   ├── wishlist.js     # wishlist + saved search alerts
│   │   ├── payments.js     # checkout, escrow, disputes (buyer/seller side)
│   │   └── admin.js        # dispute resolution + analytics
│   └── uploads/             # uploaded listing photos (created at runtime)
└── frontend/
    ├── index.html           # browse + search
    ├── listing.html         # listing detail, offer, buy, message, wishlist
    ├── sell.html             # create listing
    ├── login.html / register.html
    ├── dashboard.html       # my listings / offers / transactions / wishlist
    ├── messages.html        # inbox + conversation
    ├── admin.html            # dispute queue + analytics
    ├── css/style.css
    └── js/api.js, nav.js
```

## Running it locally

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The server serves both the API (under `/api`) and the frontend static files, so there's nothing else to configure.

A SQLite file `backend/marketplace.db` is created automatically on first run, along with a seeded admin account:

- **Admin login:** `admin@marketplace.local` / `admin123` (visit `/admin.html` after logging in)

Sign up as a regular user from the app to list items, make offers, and buy things.

## Database schema (SQLite)

- `users` — accounts, verification flag, admin flag
- `listings` — items for sale
- `offers` — negotiation history per listing
- `messages` — buyer/seller chat, optionally scoped to a listing
- `wishlist` — saved listings per user
- `saved_searches` — for new-listing alerts
- `transactions` — escrow/payment records
- `disputes` — admin-mediated resolution records

## What's mocked vs. real

| Feature | Status |
|---|---|
| Listings, search, filters | Real (SQLite) |
| Auth (bcrypt + sessions) | Real |
| Messaging | Real |
| Offers / negotiation | Real |
| Wishlist / saved search alerts | Real |
| Escrow bookkeeping, disputes, payouts | Real (in the database) |
| Actual card charge / Stripe | Simulated — see note above |
| Photo upload | Real (stored on disk under `backend/uploads`) |
