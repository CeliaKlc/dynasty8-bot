require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Fix DNS pour MongoDB sur Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const session = require('express-session');
const path    = require('path');

const authRoutes = require('./routes/auth');
const apiRoutes  = require('./routes/api');
const { connectDB } = require('../utils/db');
const agentCache    = require('../utils/agentCache');

const PORT = process.env.WEB_PORT || 3000;

const app = express();

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dynasty8-secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 24 * 60 * 60 * 1000 }, // 24h
}));

// ── Auth guard sur les pages HTML (sauf login) ────────────────────────────────
app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path.startsWith('/auth/');
  if (isPublic) return next();
  if (req.path.endsWith('.html') && !req.session.user) {
    return res.redirect('/login.html');
  }
  next();
});

// ── Fichiers statiques ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api',  apiRoutes);

// ── Démarrage ─────────────────────────────────────────────────────────────────
(async () => {
  await connectDB();
  await agentCache.init(require('../utils/db').getDB());

  app.listen(PORT, () => {
    console.log(`\n🌐 Panel Dynasty 8 démarré sur http://localhost:${PORT}`);
    console.log(`   → Pour une URL publique : ngrok http ${PORT}\n`);
  });
})();
