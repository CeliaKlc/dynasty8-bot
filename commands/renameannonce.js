const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const STATUTS = {
  'vendu':      { emoji: '✅', label: 'Vendu' },
  'loue':       { emoji: '✅', label: 'Loué' },
  'disponible': { emoji: '❌', label: 'Disponible' },
};

function toMathSansBold(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5D4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + (code - 48));
    return char;
  }).join('');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('renameannonce')
    .setDescription('✏️ Renommer un salon d\'annonce avec statut, numéro, type et secteur')
    .addStringOption(opt => opt
      .setName('statut')
      .setDescription('Statut de l\'annonce')
      .setRequired(true)
      .addChoices(
        { name: '✅ Vendu',      value: 'vendu'      },
        { name: '✅ Loué',       value: 'loue'       },
        { name: '❌ Disponible', value: 'disponible' },
      ))
    .addStringOption(opt => opt
      .setName('numero')
      .setDescription('Numéro de l\'annonce (ex: 1346)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type de bien (ex: Bureau, Appartement Simple…)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('secteur')
      .setDescription('Secteur / quartier (ex: Del-Perro, Rockford-Hills…)')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const statutKey = interaction.options.getString('statut');
    const numero    = interaction.options.getString('numero');
    const type      = interaction.options.getString('type');
    const secteur   = interaction.options.getString('secteur');

    const statut  = STATUTS[statutKey];

    // Format : ✅┃𝟭𝟯𝟰𝟲┃𝗕𝘂𝗿𝗲𝗮𝘂_𝗗𝗲𝗹-𝗣𝗲𝗿𝗿𝗼
    const newName = `${statut.emoji}┃${toMathSansBold(numero)}┃${toMathSansBold(type)}_${toMathSansBold(secteur)}`;

    try {
      await interaction.channel.setName(newName, `Renommé par ${interaction.user.tag}`);
    } catch (err) {
      console.error('[RENAMEANNONCE] Erreur :', err.message);

      if (err.status === 429 || err.code === 20028 || err.message?.toLowerCase().includes('rate limit')) {
        return interaction.editReply({
          content: '⏳ **Limite Discord atteinte** — un salon ne peut être renommé que **2 fois par 10 minutes**. Réessaie dans quelques minutes.',
        });
      }

      return interaction.editReply({
        content: '❌ Impossible de renommer le salon. Vérifie que le bot a la permission **Gérer les salons**.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(statut.emoji === '✅' ? 0x2ECC71 : 0xE74C3C)
      .setTitle('✏️ Salon d\'annonce renommé')
      .addFields(
        { name: '📋 Statut',  value: `${statut.emoji} ${statut.label}`, inline: true },
        { name: '🔢 Numéro',  value: numero,                            inline: true },
        { name: '🏠 Type',    value: type,                              inline: true },
        { name: '📍 Secteur', value: secteur,                           inline: true },
        { name: '🏷️ Résultat', value: `\`${newName}\``,                inline: false },
      )
      .setFooter({ text: 'Dynasty 8 • Gestion des annonces' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
