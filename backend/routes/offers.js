const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Buyer makes an offer
router.post('/', requireAuth, (req, res) => {
  const { listing_id, amount } = req.body;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.seller_id === req.session.userId) return res.status(400).json({ error: "You can't make an offer on your own listing." });

  const info = db.prepare('INSERT INTO offers (listing_id, buyer_id, amount) VALUES (?,?,?)')
    .run(listing_id, req.session.userId, amount);
  res.json(db.prepare('SELECT * FROM offers WHERE id = ?').get(info.lastInsertRowid));
});

// Seller counters an offer
router.post('/:id/counter', requireAuth, (req, res) => {
  const { counter_amount } = req.body;
  const offer = db.prepare('SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found.' });
  if (offer.seller_id !== req.session.userId) return res.status(403).json({ error: 'Only the seller can counter.' });

  db.prepare('UPDATE offers SET status = ?, counter_amount = ? WHERE id = ?').run('countered', counter_amount, req.params.id);
  res.json(db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id));
});

// Accept or reject an offer (either party depending on state)
router.post('/:id/respond', requireAuth, (req, res) => {
  const { action } = req.body; // 'accept' | 'reject'
  const offer = db.prepare('SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found.' });

  const isSeller = offer.seller_id === req.session.userId;
  const isBuyer = offer.buyer_id === req.session.userId;
  if (!isSeller && !isBuyer) return res.status(403).json({ error: 'Not part of this negotiation.' });

  if (action === 'accept') {
    db.prepare('UPDATE offers SET status = ? WHERE id = ?').run('accepted', req.params.id);
  } else if (action === 'reject') {
    db.prepare('UPDATE offers SET status = ? WHERE id = ?').run('rejected', req.params.id);
  } else {
    return res.status(400).json({ error: 'Invalid action.' });
  }
  res.json(db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id));
});

// List offers for a listing (seller view) or for a buyer (their own offers)
router.get('/listing/:listingId', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT o.*, u.name as buyer_name FROM offers o JOIN users u ON u.id = o.buyer_id
    WHERE o.listing_id = ? ORDER BY o.created_at DESC`).all(req.params.listingId);
  res.json(rows);
});

router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT o.*, l.title, l.price as listing_price FROM offers o JOIN listings l ON l.id = o.listing_id
    WHERE o.buyer_id = ? ORDER BY o.created_at DESC`).all(req.session.userId);
  res.json(rows);
});

module.exports = router;
