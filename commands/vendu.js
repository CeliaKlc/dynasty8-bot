// ─── /vendu — Marquer une annonce précise comme vendue (ticket multi-biens) ───

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB }      = require('../utils/db');
const { logAction }  = require('../utils/actionLogger');
const { formatPrix } = require('../utils/formatters');

const fmt = n => n != null ? `${formatPrix(String(Math.round(n)))}$` : '—';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vendu')
    .setDescription('💰 Marquer une annonce spécifique comme vendue sans fermer le ticket')
    .addStringOption(opt => opt
      .setName('annonce')
      .setDescription('Numéro de l\'annonce à clôturer (ex: 1428)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('prix')
      .setDescription('Prix de vente final (ex: 175000). Laisser vide = prix de départ.')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const annonce = interaction.options.getString('annonce').trim();
    const prixStr = interaction.options.getString('prix');

    const db    = getDB();
    const vente = await db.collection('ventes_lbc').findOne({ annonce, statut: 'en_cours' });

    // ── Vente introuvable ─────────────────────────────────────────────────────
    if (!vente) {
      // Vérifier si elle existe mais est déjà clôturée
      const existante = await db.collection('ventes_lbc').findOne({ annonce });
      if (existante?.statut === 'vendu') {
        return interaction.editReply({
          content: `⚠️ L'annonce **n°${annonce}** est déjà marquée comme vendue (le ${
            existante.dateVente
              ? new Date(existante.dateVente).toLocaleDateString('fr-FR')
              : '?'
          }).`,
        });
      }
      return interaction.editReply({
        content:
          `❌ Aucune annonce **n°${annonce}** en cours trouvée.\n` +
          `Vérifie que le numéro est correct et qu'un \`/recaplbc\` a bien été fait pour cette annonce.`,
      });
    }

    // ── Calcul du prix final ──────────────────────────────────────────────────
    const prixSaisi = prixStr
      ? parseInt(prixStr.replace(/['\s,.]/g, ''), 10) || null
      : null;
    const prixFinal = prixSaisi ?? vente.prixDepart;

    await db.collection('ventes_lbc').updateOne(
      { _id: vente._id },
      { $set: { prixFinal, statut: 'vendu', dateVente: new Date() } },
    );

    // ── Log ───────────────────────────────────────────────────────────────────
    await logAction({
      type:      'vente_cloture',
      actorId:   interaction.user.id,
      actorName: interaction.member?.displayName ?? interaction.user.username,
      details: {
        annonce:    vente.annonce,
        type:       vente.type,
        adresse:    vente.adresse,
        prixFinal,
        prixDepart: vente.prixDepart,
        via:        'vendu',
      },
    });

    // ── Réponse ───────────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`✅ Annonce n°${annonce} — Vente enregistrée`)
      .addFields(
        { name: '🏠 Type',        value: vente.type,          inline: true },
        { name: '📍 Adresse',     value: vente.adresse,       inline: true },
        { name: '💰 Prix final',  value: fmt(prixFinal),       inline: true },
        ...(vente.prixDepart && vente.prixDepart !== prixFinal
          ? [{ name: '🏷️ Prix de départ', value: fmt(vente.prixDepart), inline: true }]
          : []),
        ...(vente.type2
          ? [{ name: 'ℹ️ Lot', value: `Cette annonce était un lot avec : **${vente.type2}**${vente.type3 ? ` + **${vente.type3}**` : ''}. Le prix enregistré couvre l'ensemble du lot.`, inline: false }]
          : []),
      )
      .setFooter({ text: 'Pris en compte dans les statistiques de reprise de bien. Le ticket reste ouvert.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
