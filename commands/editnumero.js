// ─── /editnumero — Corriger le numéro d'une annonce LBC mal saisi ─────────────

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} = require('discord.js');
const { getDB }     = require('../utils/db');
const { logAction } = require('../utils/actionLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editnumero')
    .setDescription('✏️ Corriger le numéro d\'une annonce LBC mal saisi')
    .addStringOption(opt => opt
      .setName('ancien_numero')
      .setDescription('Numéro incorrect à corriger (ex: 1340)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('nouveau_numero')
      .setDescription('Numéro correct (ex: 1430)')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ancienNumero  = interaction.options.getString('ancien_numero').trim();
    const nouveauNumero = interaction.options.getString('nouveau_numero').trim();

    if (ancienNumero === nouveauNumero) {
      return interaction.editReply({ content: '❌ Les deux numéros sont identiques.' });
    }

    const db = getDB();

    // Vérifier que l'ancien numéro est connu
    const link = await db.collection('annonce_links').findOne({ numero: ancienNumero });
    if (!link) {
      return interaction.editReply({
        content:
          `❌ Aucune annonce trouvée avec le numéro **${ancienNumero}**.\n` +
          `Vérifie que le numéro correspond bien à une annonce enregistrée.`,
      });
    }

    // Vérifier que le nouveau numéro n'est pas déjà pris
    const conflit = await db.collection('annonce_links').findOne({ numero: nouveauNumero });
    if (conflit) {
      return interaction.editReply({
        content: `❌ Le numéro **${nouveauNumero}** est déjà utilisé par une autre annonce.`,
      });
    }

    const resultats = { ventes_lbc: 0, bouton: false, boutonIntrouvable: false };

    // ── 1. Mettre à jour annonce_links ────────────────────────────────────────
    await db.collection('annonce_links').updateOne(
      { numero: ancienNumero },
      { $set: { numero: nouveauNumero, updatedAt: new Date() } },
    );

    // ── 2. Mettre à jour ventes_lbc (tous les recaps liés à cet ancien numéro) ─
    const r2 = await db.collection('ventes_lbc').updateMany(
      { annonce: ancienNumero },
      { $set: { annonce: nouveauNumero } },
    );
    resultats.ventes_lbc = r2.modifiedCount;

    // ── 3. Mettre à jour les boutons du message d'annonce Discord ─────────────
    if (link.announcementChannelId && link.messageId) {
      try {
        const channel = await interaction.client.channels.fetch(link.announcementChannelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(link.messageId).catch(() => null) : null;

        if (message) {
          // Reconstruire chaque bouton en remplaçant le numéro dans les customIds
          const newComponents = message.components.map(row =>
            new ActionRowBuilder().addComponents(
              row.components.map(btn => {
                const b = new ButtonBuilder()
                  .setStyle(btn.style)
                  .setLabel(btn.label ?? '');
                if (btn.emoji)    b.setEmoji(btn.emoji);
                if (btn.disabled) b.setDisabled(true);
                if (btn.url) {
                  b.setURL(btn.url);
                } else {
                  // Remplace le numéro uniquement dans les customIds qui le contiennent
                  const newId = (btn.customId ?? '')
                    .replace(`annonce_acheter_${ancienNumero}_`, `annonce_acheter_${nouveauNumero}_`)
                    .replace(`annonce_visiter_${ancienNumero}_`, `annonce_visiter_${nouveauNumero}_`);
                  b.setCustomId(newId);
                }
                return b;
              }),
            ),
          );
          await message.edit({ components: newComponents });
          resultats.bouton = true;
        } else {
          resultats.boutonIntrouvable = true;
        }
      } catch (e) {
        console.error('[EDITNUMERO] Erreur MAJ boutons :', e.message);
        resultats.boutonIntrouvable = true;
      }
    }

    // ── Log ───────────────────────────────────────────────────────────────────
    await logAction({
      type:      'edit_numero',
      actorId:   interaction.user.id,
      actorName: interaction.member?.displayName ?? interaction.user.username,
      details:   { ancienNumero, nouveauNumero, ...resultats },
    });

    // ── Réponse ───────────────────────────────────────────────────────────────
    const lignes = [`✅ Numéro corrigé : **${ancienNumero}** → **${nouveauNumero}**`];

    if (resultats.ventes_lbc > 0) {
      lignes.push(`• ${resultats.ventes_lbc} récap(s) LBC mis à jour en base`);
    }

    if (resultats.bouton) {
      lignes.push('• Boutons du message d\'annonce Discord mis à jour ✅');
    } else if (resultats.boutonIntrouvable) {
      lignes.push('• ⚠️ Message d\'annonce Discord introuvable (supprimé ?). Si l\'annonce est encore en ligne, refais `/annonce` avec le bon numéro.');
    } else if (!link.messageId) {
      lignes.push('• ℹ️ Boutons non mis à jour — cette annonce a été publiée avant la mise à jour du bot. Refais `/editannonce` pour republier avec le bon numéro dans les boutons.');
    }

    if (resultats.ventes_lbc > 0 || link.ticketChannelId) {
      lignes.push('• ℹ️ Si un `/recaplbc` a déjà été fait, le message dans le ticket affiche toujours l\'ancien numéro (visuel uniquement — la base de données est correcte).');
    }

    await interaction.editReply({ content: lignes.join('\n') });
  },
};
