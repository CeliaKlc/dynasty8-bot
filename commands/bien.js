const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../utils/db');
const { TYPE_EMOJIS } = require('../utils/attenteManager');

const TYPES = [
  'Appartement Simple', 'Appartement Basique', 'Maison Simple', 'Caravane',
  'Appartement Favelas', 'Maison Favelas', 'Studio de Luxe', 'Appartement Moderne',
  'Duplex', 'Appartement de Luxe Modifiable', 'Villa', 'Maison de Luxe',
  'Villa de Luxe', 'Bureau', 'Agence', 'Hangar', 'Entrepôt',
  'Garage 2 places', 'Garage 6 places', 'Garage 10 places', 'Garage 26 places', 'Loft Garage',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bien')
    .setDescription('Enregistrer un bien disponible et trouver les clients correspondants')
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type de bien')
      .setRequired(true)
      .addChoices(...TYPES.map(t => ({ name: t, value: t }))))
    .addStringOption(opt => opt
      .setName('zone')
      .setDescription('Secteur du bien (ex: Vinewood, Rockford Hills, Nord...)')
      .setRequired(true))
    .addIntegerOption(opt => opt
      .setName('prix')
      .setDescription('Prix du bien ($)')
      .setRequired(true)
      .setMinValue(0))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description du bien (optionnel)')
      .setRequired(false)),

  async execute(interaction) {
    const type        = interaction.options.getString('type');
    const zone        = interaction.options.getString('zone');
    const prix        = interaction.options.getInteger('prix');
    const description = interaction.options.getString('description') ?? null;

    const db = getDB();

    // Clients dont un bien correspond exactement au type + secteur
    // et dont le budget max est suffisant
    const matches = await db.collection('waiting_list').find({
      biens:        { $elemMatch: { type, zone: { $regex: zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } },
      status:       'active',
      'budget.max': { $gte: prix },
    }).sort({ createdAt: 1 }).toArray();

    const embed = new EmbedBuilder()
      .setTitle(`${TYPE_EMOJIS[type] ?? '🏠'} Nouveau bien disponible`)
      .setColor(matches.length > 0 ? 0x2ECC71 : 0x95A5A6)
      .addFields(
        { name: '🏷️ Type',  value: type,                                inline: true },
        { name: '📍 Secteur', value: zone,                               inline: true },
        { name: '💰 Prix',  value: `${prix.toLocaleString('fr-FR')} $`, inline: true },
        ...(description ? [{ name: '📝 Description', value: description, inline: false }] : []),
      )
      .setTimestamp()
      .setFooter({ text: `Enregistré par ${interaction.user.username}` });

    if (matches.length > 0) {
      const lines = matches.map((c, i) => {
        const budget = `max ${c.budget.max.toLocaleString('fr-FR')} $`;
        const ticket = c.ticketId ? ` — 🎫 <#${c.ticketId}>` : '';
        return `**${i + 1}.** <@${c.clientId}> — ${budget}${ticket}`;
      });

      embed
        .setDescription(`> ⚠️ **${matches.length} client(s)** en liste d'attente correspondent à ce bien !`)
        .addFields({ name: '🎯 Clients correspondants', value: lines.join('\n') });
    } else {
      embed.setDescription('> Aucun client en liste d\'attente ne correspond à ce bien pour le moment.');
    }

    return interaction.reply({ embeds: [embed] });
  },
};
