// ─── Discord OAuth2 ───────────────────────────────────────────────────────────

const { Router } = require('express');
const router = Router();

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;
const GUILD_ID      = process.env.GUILD_ID;

// Rôles autorisés à accéder au panel
const ROLES_ADMIN  = ['1375930527873368066']; // Direction
const ROLES_ACCESS = ['917744433682849802', '1375930527873368066']; // Employé + Direction

// ── /auth/login — Redirige vers Discord OAuth ─────────────────────────────────
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'identify guilds.members.read',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// ── /auth/callback — Échange le code et crée la session ──────────────────────
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login.html?error=no_code');

  try {
    // 1. Échange code → token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('Token invalide');

    // 2. Infos utilisateur
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = await userRes.json();

    // 3. Membre du serveur (pour les rôles)
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    const member = await memberRes.json();
    const roles  = member.roles ?? [];

    const hasAccess = ROLES_ACCESS.some(r => roles.includes(r));
    if (!hasAccess) return res.redirect('/login.html?error=unauthorized');

    // 4. Sauvegarde en session
    req.session.user = {
      id:       user.id,
      username: user.username,
      avatar:   user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`,
      isAdmin:  ROLES_ADMIN.some(r => roles.includes(r)),
    };

    res.redirect('/');
  } catch (err) {
    console.error('[Auth] Erreur OAuth :', err);
    res.redirect('/login.html?error=server');
  }
});

// ── /auth/logout ─────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ── /auth/me — Infos session courante (appelé par le frontend) ────────────────
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  res.json(req.session.user);
});

module.exports = router;
