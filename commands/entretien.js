// ─── Commande /entretien — Créneaux horaires interactifs ─────────────────────

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getDB } = require('../utils/db');

// Emojis de créneaux (index 0 → '1️⃣', ..., index 9 → '🔟')
const SLOT_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// ── Helpers de temps ──────────────────────────────────────────────────────────

function parseTime(str) {
  const m = str.trim().match(/^(\d{1,2})[hH:](\d{2})$/);
  if (!m) return null;
  return { hours: parseInt(m[1]), minutes: parseInt(m[2]) };
}

function addMinutes({ hours, minutes }, mins) {
  const total = hours * 60 + minutes + mins;
  return { hours: Math.floor(total / 60) % 24, minutes: total % 60 };
}

function formatTime({ hours, minutes }) {
  return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;
}

// ── Construction du contenu du message ───────────────────────────────────────

function buildContent(entretien) {
  const lignes = entretien.creneaux
    .map((c, i) => `${SLOT_EMOJIS[i]} **${c.heure}** : ${c.userId ? `<@${c.userId}>` : ''}`)
    .join('\n');

  const intro = entretien.roleId
    ? `<@&${entretien.roleId}>, je vous propose aujourd'hui **${entretien.date}** à partir de **${entretien.creneaux[0].heure}** à l'agence Dynasty 8 🏠.`
    : `Je vous propose aujourd'hui **${entretien.date}** à partir de **${entretien.creneaux[0].heure}** à l'agence Dynasty 8 🏠.`;

  const embed = new EmbedBuilder()
    .setColor(0x076633)
    .setDescription(
      `${intro}\n\n` +
      `Pour plus de facilité et vous éviter un temps d'attente inutile, nous allons mettre des tranches horaires, ` +
      `vous avez juste à mettre celle que vous préférez.\n\n` +
      `⚠️ Session limitée à **${entretien.limite}** personne${entretien.limite > 1 ? 's' : ''}.\n\n` +
      `**Les candidats retenus pour cet entretien sont :**\n${lignes}`,
    );

  return { embeds: [embed] };
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  SLOT_EMOJIS,
  buildContent,

  data: new SlashCommandBuilder()
    .setName('entretien')
    .setDescription('📅 Créer un message de créneaux d\'entretien interactif')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt
      .setName('date')
      .setDescription('Date de l\'entretien (ex: Lundi 08/09)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('heure_debut')
      .setDescription('Heure du premier créneau (ex: 20h00)')
      .setRequired(true))
    .addIntegerOption(opt => opt
      .setName('creneaux')
      .setDescription('Nombre de créneaux (1 à 10)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(10))
    .addIntegerOption(opt => opt
      .setName('intervalle')
      .setDescription('Intervalle en minutes entre chaque créneau (défaut : 20)')
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(120))
    .addRoleOption(opt => opt
      .setName('role')
      .setDescription('Rôle à mentionner dans le message')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('limite')
      .setDescription('Nombre de personnes affichées dans la limite (défaut = nb créneaux)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const dateStr    = interaction.options.getString('date');
    const heureStr   = interaction.options.getString('heure_debut');
    const nbCreneaux = interaction.options.getInteger('creneaux');
    const intervalle = interaction.options.getInteger('intervalle') ?? 20;
    const role       = interaction.options.getRole('role');
    const limite     = interaction.options.getInteger('limite') ?? nbCreneaux;

    const startTime = parseTime(heureStr);
    if (!startTime) {
      return interaction.editReply({ content: '❌ Format d\'heure invalide. Utilise `20h00` par exemple.' });
    }

    // Générer les créneaux
    const creneaux = Array.from({ length: nbCreneaux }, (_, i) => ({
      index:  i,
      heure:  formatTime(i === 0 ? startTime : addMinutes(startTime, intervalle * i)),
      userId: null,
    }));

    const doc = {
      channelId: interaction.channel.id,
      guildId:   interaction.guild.id,
      date:      dateStr,
      roleId:    role?.id ?? null,
      creneaux,
      limite,
      createdBy: interaction.user.id,
      createdAt: new Date(),
    };

    // Envoyer le message avec mention du rôle (ping initial uniquement)
    const msg = await interaction.channel.send({
      ...buildContent(doc),
      allowedMentions: { roles: role ? [role.id] : [] },
    });

    // Sauvegarder en base
    doc.messageId = msg.id;
    await getDB().collection('entretiens').insertOne(doc);

    // Ajouter les réactions numérotées dans l'ordre
    for (let i = 0; i < nbCreneaux; i++) {
      await msg.react(SLOT_EMOJIS[i]).catch(() => {});
    }

    await interaction.editReply({
      content: `✅ Message d'entretien créé avec **${nbCreneaux} créneau${nbCreneaux > 1 ? 'x' : ''}** dans <#${interaction.channel.id}>.`,
    });
  },
};
