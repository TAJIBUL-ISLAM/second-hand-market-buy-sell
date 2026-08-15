const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);

  req.session.userId = info.lastInsertRowid;
  req.session.isAdmin = false;
  res.json({ id: info.lastInsertRowid, name, email, is_verified: 0 });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  req.session.isAdmin = !!user.is_admin;
  res.json({ id: user.id, name: user.name, email: user.email, is_verified: user.is_verified, is_admin: user.is_admin });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, is_verified, is_admin FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// simple "verify" endpoint - in real life this would check a govt ID upload
router.post('/verify-me', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
