const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// CO2-saved estimate per category, in kg (rough illustrative figures)
const CO2_BY_CATEGORY = {
  electronics: 85, furniture: 45, clothing: 8, books: 2, vehicles: 500,
  appliances: 120, sports: 15, toys: 5, other: 10
};

function withCo2(listing) {
  const cat = (listing.category || 'other').toLowerCase();
  return { ...listing, co2_saved_kg: CO2_BY_CATEGORY[cat] ?? CO2_BY_CATEGORY.other };
}

// Create listing
router.post('/', requireAuth, upload.single('photo'), (req, res) => {
  const { title, description, category, price, condition_grade, location } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price are required.' });
  const photo = req.file ? '/uploads/' + req.file.filename : null;

  const info = db.prepare(`INSERT INTO listings (seller_id, title, description, category, price, condition_grade, location, photo)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.session.userId, title, description || '', category || 'other', parseFloat(price), condition_grade || 'good', location || '', photo);

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(info.lastInsertRowid);
  res.json(withCo2(listing));
});

// Search / filter / list
router.get('/', (req, res) => {
  const { q, category, min_price, max_price, location, status } = req.query;
  let sql = `SELECT l.*, u.name as seller_name, u.is_verified as seller_verified
             FROM listings l JOIN users u ON u.id = l.seller_id WHERE 1=1`;
  const params = [];

  sql += ` AND l.status = ?`; params.push(status || 'active');
  if (q) { sql += ` AND (l.title LIKE ? OR l.description LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
  if (category) { sql += ` AND l.category = ?`; params.push(category); }
  if (min_price) { sql += ` AND l.price >= ?`; params.push(parseFloat(min_price)); }
  if (max_price) { sql += ` AND l.price <= ?`; params.push(parseFloat(max_price)); }
  if (location) { sql += ` AND l.location LIKE ?`; params.push(`%${location}%`); }
  sql += ` ORDER BY l.created_at DESC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(withCo2));
});

// Detail
router.get('/:id', (req, res) => {
  const listing = db.prepare(`SELECT l.*, u.name as seller_name, u.is_verified as seller_verified
    FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?`).get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json(withCo2(listing));
});

// Update (owner only)
router.put('/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.seller_id !== req.session.userId) return res.status(403).json({ error: 'Not your listing.' });

  const { title, description, category, price, condition_grade, location, status } = req.body;
  db.prepare(`UPDATE listings SET title=?, description=?, category=?, price=?, condition_grade=?, location=?, status=? WHERE id=?`)
    .run(title ?? listing.title, description ?? listing.description, category ?? listing.category,
         price ?? listing.price, condition_grade ?? listing.condition_grade, location ?? listing.location,
         status ?? listing.status, req.params.id);

  res.json(withCo2(db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)));
});

// Delete (owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.seller_id !== req.session.userId) return res.status(403).json({ error: 'Not your listing.' });
  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mine
router.get('/mine/list', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(rows.map(withCo2));
});

module.exports = router;
