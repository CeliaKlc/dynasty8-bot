module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`
╔═══════════════════════════════════════╗
║   🏠  DYNASTY 8 - BOT EN LIGNE  🏠   ║
║   Connecté en tant que ${client.user.tag.padEnd(15)}║
╚═══════════════════════════════════════╝
    `);
    client.user.setActivity('Dynasty 8 | Baylife RP', { type: 3 });
  },
};
