const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { toMathSans } = require('../utils/formatters');

// ─── Données des cartes agents ────────────────────────────────────────────────
// Remplis : titre, numero, photo (URL image)
const CARTES = {
  '314057285523472394':  { nom: 'Sacha Rollay',         titre: 'Patronne',            numero: '509360',    photo: 'https://img.draftbot.fr/1766939951033-3d6bbfc6de6411a2.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '261956403546161152':  { nom: 'Ely Rollay',           titre: 'Patron',              numero: '0640200',   photo: 'https://img.draftbot.fr/1766518616384-7f0fe8eeed22fd98.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '1151865005239697449': { nom: 'Marco Romanov',        titre: 'Patron',              numero: '68500',     photo: 'https://img.draftbot.fr/1775907175185-5df7d00ab926fd60.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '922112971793133568':  { nom: 'John Russet',          titre: 'Agent Immobilier',    numero: '4523947',   photo: 'https://img.draftbot.fr/1773406483462-1ac7d8a1e35074c6.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '273565768355151874':  { nom: 'Hain Ergy',            titre: 'Agent Immobilier',    numero: '12354',     photo: 'https://img.draftbot.fr/1768517004762-7ca455a27fad5bbf.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '343731754311614465':  { nom: 'Maksim Anatolyevich',  titre: 'Agent Immobilier',    numero: '4343627',   photo: 'https://img.draftbot.fr/1765411964408-d43caa09d436ebce.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '394751095932583937':  { nom: 'John Macafey',         titre: 'Agent Immobilier',    numero: '353182',    photo: 'https://img.draftbot.fr/1767989376583-c813a51ee47ee341.png',   agre: ['Las Venturas', 'Gestionnaire LBC'] },
  '871705632414269491':  { nom: 'Piper Pipou',          titre: 'Agente Immobilière',  numero: '323635',    photo: 'https://img.draftbot.fr/1775841304111-8c9693903646e149.png',   agre: [] },
  '1082632036906438757': { nom: 'Franklin Warner',      titre: 'Agent Immobilier',    numero: '946430',    photo: 'https://img.draftbot.fr/1774219842061-07aabc1491290c30.png',   agre: [] },
  '976601674976206868':  { nom: 'Ben Lafayette',        titre: 'Agent Immobilier',    numero: '6133',      photo: 'https://img.draftbot.fr/1774826009858-68a9c394d7abbf7d.png',   agre: [] },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carte')
    .setDescription('Afficher sa carte d\'agent Dynasty 8 en service'),

  async execute(interaction) {
    const carte = CARTES[interaction.user.id];

    if (!carte) {
      return interaction.reply({ content: '❌ Tu n\'as pas de carte configurée. Contacte un administrateur.', ephemeral: true });
    }

    if (!carte.numero) {
      return interaction.reply({ content: '❌ Ta carte n\'est pas encore complétée (numéro manquant). Contacte un administrateur.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: toMathSans('⠀⠀⠀⠀⠀⠀⠀CARTE DE VISITE⠀⠀⠀⠀⠀⠀⠀'), iconURL: interaction.client.user.displayAvatarURL() })
      .setDescription([
        `## ${carte.nom}`,
        carte.titre,
        ``,
        `**Numéro ☎️ :**`,
        `\`\`\`${carte.numero}\`\`\``,
        ...(carte.agre.length > 0 ? [`**Habilitation 🗒️ :**`, ...carte.agre.map(h => `- ${h}`)] : []),
      ].join('\n'))
      .setFooter({ text: 'Dynasty 8', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    if (carte.photo) embed.setThumbnail(carte.photo);

    return interaction.reply({ embeds: [embed] });
  },
};
