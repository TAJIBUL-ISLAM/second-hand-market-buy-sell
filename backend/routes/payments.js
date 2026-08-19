const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
 * NOTE ON PAYMENTS
 * ------------------------------------------------------------------
 * This project runs in a sandboxed environment with no access to the
 * real Stripe API. This module simulates a Stripe Checkout + escrow
 * flow end-to-end (create payment intent -> hold in escrow -> release
 * to seller on confirmed receipt -> refund on dispute) so the rest of
 * the app (buyer protection, payouts, disputes) works exactly the way
 * it would with Stripe Connect wired in. To go live: swap
 * `fakeChargeCard()` below for a real `stripe.paymentIntents.create()`
 * call and use Stripe Connect for the seller payout step.
 * ------------------------------------------------------------------
 */

function fakeChargeCard(amount) {
  // Simulated card charge - always "succeeds" in this demo
  return { success: true, charge_id: 'ch_demo_' + Date.now() };
}

// Buyer pays -> funds held in escrow
router.post('/checkout', requireAuth, (req, res) => {
  const { listing_id, delivery_type } = req.body;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is no longer available.' });
  if (listing.seller_id === req.session.userId) return res.status(400).json({ error: "You can't buy your own listing." });

  const charge = fakeChargeCard(listing.price);
  if (!charge.success) return res.status(402).json({ error: 'Payment failed.' });

  const info = db.prepare(`INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, status, delivery_type)
    VALUES (?,?,?,?, 'escrow', ?)`).run(listing_id, req.session.userId, listing.seller_id, listing.price, delivery_type || 'delivery');

  db.prepare(`UPDATE listings SET status = 'sold' WHERE id = ?`).run(listing_id);

  res.json({
    transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid),
    charge_id: charge.charge_id,
    message: 'Payment captured and held in escrow. Funds will be released to the seller once you confirm receipt.'
  });
});

// Buyer confirms receipt -> instant payout to seller
router.post('/:transactionId/confirm-receipt', requireAuth, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.transactionId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  if (tx.buyer_id !== req.session.userId) return res.status(403).json({ error: 'Only the buyer can confirm receipt.' });
  if (tx.status !== 'escrow') return res.status(400).json({ error: `Transaction is already ${tx.status}.` });

  db.prepare(`UPDATE transactions SET status = 'released', released_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tx.id);
  res.json({ ok: true, message: 'Receipt confirmed. Funds released to seller instantly.' });
});

// Either party raises a dispute
router.post('/:transactionId/dispute', requireAuth, (req, res) => {
  const { reason } = req.body;
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.transactionId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  if (tx.buyer_id !== req.session.userId && tx.seller_id !== req.session.userId) {
    return res.status(403).json({ error: 'Not part of this transaction.' });
  }
  if (tx.status === 'released' || tx.status === 'refunded') {
    return res.status(400).json({ error: 'Transaction already settled, cannot dispute.' });
  }

  db.prepare(`UPDATE transactions SET status = 'disputed' WHERE id = ?`).run(tx.id);
  const info = db.prepare('INSERT INTO disputes (transaction_id, raised_by, reason) VALUES (?,?,?)')
    .run(tx.id, req.session.userId, reason || '');
  res.json(db.prepare('SELECT * FROM disputes WHERE id = ?').get(info.lastInsertRowid));
});

// My transactions (as buyer or seller)
router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT t.*, l.title FROM transactions t JOIN listings l ON l.id = t.listing_id
    WHERE t.buyer_id = ? OR t.seller_id = ? ORDER BY t.created_at DESC`)
    .all(req.session.userId, req.session.userId);
  res.json(rows);
});

module.exports = router;
