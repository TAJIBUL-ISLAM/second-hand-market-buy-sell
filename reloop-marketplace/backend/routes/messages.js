const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Send a message
router.post('/', requireAuth, (req, res) => {
  const { receiver_id, listing_id, body } = req.body;
  if (!receiver_id || !body) return res.status(400).json({ error: 'receiver_id and body are required.' });

  const info = db.prepare('INSERT INTO messages (listing_id, sender_id, receiver_id, body) VALUES (?,?,?,?)')
    .run(listing_id || null, req.session.userId, receiver_id, body);
  res.json(db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid));
});

// Get conversation with a specific user (optionally scoped to a listing)
router.get('/conversation/:otherUserId', requireAuth, (req, res) => {
  const { listing_id } = req.query;
  let sql = `SELECT * FROM messages WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`;
  const params = [req.session.userId, req.params.otherUserId, req.params.otherUserId, req.session.userId];
  if (listing_id) { sql += ' AND listing_id = ?'; params.push(listing_id); }
  sql += ' ORDER BY created_at ASC';

  const rows = db.prepare(sql).all(...params);
  db.prepare(`UPDATE messages SET read_flag = 1 WHERE receiver_id = ? AND sender_id = ?`)
    .run(req.session.userId, req.params.otherUserId);
  res.json(rows);
});

// List all conversations (inbox) - most recent message per other-user
router.get('/inbox', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name as other_name,
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_id
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.created_at DESC
  `).all(req.session.userId, req.session.userId, req.session.userId, req.session.userId);

  const seen = new Set();
  const inbox = [];
  for (const r of rows) {
    if (!seen.has(r.other_id)) {
      seen.add(r.other_id);
      inbox.push(r);
    }
  }
  res.json(inbox);
});

module.exports = router;
