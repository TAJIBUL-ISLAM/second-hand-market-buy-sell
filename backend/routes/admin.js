const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// List open disputes
router.get('/disputes', (req, res) => {
  const rows = db.prepare(`SELECT d.*, t.amount, t.listing_id, t.buyer_id, t.seller_id, l.title
    FROM disputes d JOIN transactions t ON t.id = d.transaction_id JOIN listings l ON l.id = t.listing_id
    ORDER BY d.created_at DESC`).all();
  res.json(rows);
});

// Resolve a dispute: release to seller, refund buyer, or partial refund
router.post('/disputes/:id/resolve', (req, res) => {
  const { resolution, note, partial_amount } = req.body; // resolution: 'release' | 'refund' | 'partial'
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found.' });

  let txStatus;
  if (resolution === 'release') txStatus = 'released';
  else if (resolution === 'refund') txStatus = 'refunded';
  else if (resolution === 'partial') txStatus = 'partial_refund';
  else return res.status(400).json({ error: 'Invalid resolution type.' });

  db.prepare('UPDATE transactions SET status = ?, released_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(txStatus, dispute.transaction_id);
  db.prepare('UPDATE disputes SET status = ?, resolution_note = ? WHERE id = ?')
    .run('resolved_' + resolution, note || (partial_amount ? `Partial refund: ${partial_amount}` : ''), req.params.id);

  res.json({ ok: true });
});

// Analytics dashboard
router.get('/analytics', (req, res) => {
  const totalListings = db.prepare('SELECT COUNT(*) as c FROM listings').get().c;
  const activeListings = db.prepare(`SELECT COUNT(*) as c FROM listings WHERE status = 'active'`).get().c;
  const soldListings = db.prepare(`SELECT COUNT(*) as c FROM listings WHERE status = 'sold'`).get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const verifiedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_verified = 1').get().c;
  const revenue = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE status IN ('released','escrow')`).get().total;
  const openDisputes = db.prepare(`SELECT COUNT(*) as c FROM disputes WHERE status = 'open'`).get().c;
  const byCategory = db.prepare(`SELECT category, COUNT(*) as count FROM listings GROUP BY category`).all();

  res.json({ totalListings, activeListings, soldListings, totalUsers, verifiedUsers, revenue, openDisputes, byCategory });
});

module.exports = router;
