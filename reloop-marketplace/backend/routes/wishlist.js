const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { listing_id } = req.body;
  try {
    db.prepare('INSERT INTO wishlist (user_id, listing_id) VALUES (?,?)').run(req.session.userId, listing_id);
  } catch (e) { /* already in wishlist - ignore unique constraint */ }
  res.json({ ok: true });
});

router.delete('/:listingId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND listing_id = ?').run(req.session.userId, req.params.listingId);
  res.json({ ok: true });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT l.* FROM wishlist w JOIN listings l ON l.id = w.listing_id WHERE w.user_id = ? ORDER BY w.created_at DESC`)
    .all(req.session.userId);
  res.json(rows);
});

// Saved searches -> new-listing alerts
router.post('/saved-search', requireAuth, (req, res) => {
  const { category, keyword, max_price, location } = req.body;
  const info = db.prepare('INSERT INTO saved_searches (user_id, category, keyword, max_price, location) VALUES (?,?,?,?,?)')
    .run(req.session.userId, category || null, keyword || null, max_price || null, location || null);
  res.json({ id: info.lastInsertRowid });
});

router.get('/saved-search', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_searches WHERE user_id = ?').all(req.session.userId);
  res.json(rows);
});

// Check which of the user's saved searches match a given listing (called after a new listing is created)
router.get('/saved-search/matches/:listingId', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.listingId);
  if (!listing) return res.json([]);
  const searches = db.prepare('SELECT * FROM saved_searches').all();
  const matches = searches.filter(s => {
    if (s.category && s.category !== listing.category) return false;
    if (s.max_price && listing.price > s.max_price) return false;
    if (s.location && !listing.location.toLowerCase().includes(s.location.toLowerCase())) return false;
    if (s.keyword && !listing.title.toLowerCase().includes(s.keyword.toLowerCase())) return false;
    return true;
  });
  res.json(matches);
});

module.exports = router;
