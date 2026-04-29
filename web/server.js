require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Fix DNS pour MongoDB sur Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const session = require('express-session');
const path    = require('path');

const authRoutes = require('./routes/auth');
const apiRoutes  = require('./routes/api');
const { connectDB, getDB } = require('../utils/db');
const agentCache    = require('../utils/agentCache');
const bienCache     = require('../utils/bienCache');
const { BIENS }     = require('../utils/annonceBuilder');
const { broadcast } = require('./utils/sse');

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

// ── Change stream SSE avec reconnexion automatique ───────────────────────────
// Si MongoDB fait un clignotement réseau, le stream se réouvre sans perdre le
// temps réel côté panel.
function watchSSE(collection, sections, retryMs = 5000) {
  const open = () => {
    try {
      const stream = getDB().collection(collection)
        .watch([], { fullDocument: 'updateLookup' });
      stream.on('change', () => broadcast('refresh', { sections }));
      stream.on('error', err => {
        console.error(`[SSE] Erreur watch ${collection} : ${err.message} — reconnexion dans ${retryMs / 1000}s`);
        setTimeout(open, retryMs);
      });
      stream.on('close', () => {
        console.warn(`[SSE] ⚠️ Stream ${collection} fermé (invalidation MongoDB) — reconnexion dans ${retryMs / 1000}s`);
        setTimeout(open, retryMs);
      });
    } catch (err) {
      console.error(`[SSE] Impossible de surveiller ${collection} : ${err.message} — retry dans ${retryMs / 1000}s`);
      setTimeout(open, retryMs);
    }
  };
  open();
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
(async () => {
  await connectDB();
  await agentCache.init(getDB());
  await bienCache.init(getDB(), BIENS);

  // ── Change streams → diffusion SSE temps réel ────────────────────────────
  // Chaque modification en base est immédiatement poussée aux clients connectés.
  const streams = [
    { collection: 'annonce_links', sections: ['annonces'] },
    { collection: 'ventes_lbc',    sections: ['annonces', 'dashboard'] },
    { collection: 'rendez_vous',   sections: ['rdv', 'alerts'] },
    { collection: 'waiting_list',  sections: ['attente'] },
    { collection: 'agents',        sections: ['agents', 'dashboard'] },
    { collection: 'sac_registry',  sections: ['sacs', 'dashboard'] },
    { collection: 'action_logs',   sections: ['logs'] },
    { collection: 'recap_hebdo',   sections: ['recap', 'dashboard'] },
    { collection: 'bien_types',    sections: ['biens'] },
  ];

  for (const { collection, sections } of streams) {
    watchSSE(collection, sections);
  }
  console.log('[SSE] Change streams actifs — diffusion temps réel activée');

  app.listen(PORT, () => {
    console.log(`\n🌐 Panel Dynasty 8 démarré sur http://localhost:${PORT}`);
    console.log(`   → Pour une URL publique : ngrok http ${PORT}\n`);
  });
})().catch(err => {
  console.error('[FATAL] Erreur au démarrage du panel web :', err);
  process.exit(1);
});
