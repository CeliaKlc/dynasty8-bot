const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Logo Dynasty 8 (icône author + footer) ──────────────────────────────────
const DYNASTY8_LOGO = 'https://cdn.discordapp.com/emojis/1489223936620236841.png';

// ─── Configuration des agents ────────────────────────────────────────────────
const AGENTS = {
  sacha: {
    nom: 'Sacha Rollay',
    emoji: '🦊',
    grade: 'Patronne',
    telephone: '50.93.60',
    aggregations: ['Las Venturas', 'Gestionnaire LBC'],
    photo: 'https://i.goopics.net/ostegf.png',    // grande photo en bas
    thumbnail: 'https://i.goopics.net/s4vqap.png', // image haut droite
  },
};

// ─── Couleur Dynasty 8 ───────────────────────────────────────────────────────
const DYNASTY8_COLOR = 0xF5A623;

// ─── Construction de l'embed carte de visite ─────────────────────────────────
function buildCarteEmbed(agent) {
  const descLines = [
    `# ${agent.emoji}  ${agent.nom}`,
    `### ${agent.grade}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '**📞  TÉLÉPHONE**',
    `## ${agent.telephone}`,
  ];

  if (agent.aggregations && agent.aggregations.length > 0) {
    descLines.push('');
    descLines.push('**🎖️  AGRÉGATIONS**');
    descLines.push(agent.aggregations.map(a => `・${a}`).join('  '));
  }

  const authorOptions = { name: 'Dynasty 8 Real Estate' };
  if (DYNASTY8_LOGO) authorOptions.iconURL = DYNASTY8_LOGO;

  const footerOptions = { text: '◈  Dynasty 8  ◈' };
  if (DYNASTY8_LOGO) footerOptions.iconURL = DYNASTY8_LOGO;

  const embed = new EmbedBuilder()
    .setAuthor(authorOptions)
    .setTitle('◈  CARTE DE VISITE  ◈')
    .setColor(DYNASTY8_COLOR)
    .setDescription(descLines.join('\n'))
    .setFooter(footerOptions)
    .setTimestamp();

  if (agent.thumbnail) embed.setThumbnail(agent.thumbnail);

  return embed;
}

// ─── Génération des commandes (une par agent) ─────────────────────────────────
const commands = Object.entries(AGENTS).map(([key, agent]) => ({
  data: new SlashCommandBuilder()
    .setName(key)
    .setDescription(`Carte de visite de ${agent.nom}`),
  async execute(interaction) {
    await interaction.reply({ embeds: [buildCarteEmbed(agent)] });
  },
}));

module.exports = { commands };
