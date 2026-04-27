const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { handleAnnonceButton, handleAnnonceModal } = require('../commands/annonce');
const { handlePrepatchnoteModal } = require('../commands/prepatchnote');
const { buildListeDetaillee } = require('../utils/attenteManager');
const { handleAttenteSelect, handleAttenteSaisirZones, handleAttenteZonesModal } = require('../commands/attente');
const { handleCarteCheck } = require('../commands/carte');
const { handleEmbedModal } = require('../commands/embed');
const { handleRecapSemaineModal } = require('../commands/recapSemaine');
const { handleSacHistorique, handleSacDonnerSelect, handleSacRetirerSelect } = require('../commands/sac');
const { getDB } = require('../utils/db');

const ROLES_AUTORISES = [
  '917744433682849802', // Employé
  '1375930527873368066', // Direction
];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // === BOUTONS ===
    if (interaction.isButton()) {
      // Boutons d'annonce — accessibles à tous
      if (interaction.customId.startsWith('annonce_acheter_') || interaction.customId.startsWith('annonce_visiter_')) {
        try {
          await handleAnnonceButton(interaction);
        } catch (err) {
          console.error('❌ Erreur bouton annonce :', err);
          const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }

      // Bouton notification LBC — toggle rôle @Notification-LBC
      if (interaction.customId === 'annonce_notif') {
        const roleId = '1345415367333380156';
        try {
          const hasRole = interaction.member.roles.cache.has(roleId);
          if (hasRole) {
            await interaction.member.roles.remove(roleId);
            await interaction.reply({ content: '🔕 Tu ne recevras plus les notifications LBC.', ephemeral: true });
          } else {
            await interaction.member.roles.add(roleId);
            await interaction.reply({ content: '🔔 Tu recevras maintenant les notifications LBC !', ephemeral: true });
          }
        } catch (err) {
          console.error('❌ Erreur toggle notification LBC :', err);
          await interaction.reply({ content: '❌ Impossible de modifier ton rôle. Contacte un administrateur.', ephemeral: true });
        }
        return;
      }

      // Bouton confirmation carte en service
      if (interaction.customId.startsWith('carte_check_')) {
        try { await handleCarteCheck(interaction); } catch (err) {
          console.error('❌ Erreur carte_check :', err);
          await interaction.update({ content: '❌ Une erreur est survenue.', components: [] }).catch(() => {});
        }
        return;
      }

      // Bouton historique des sacs
      if (interaction.customId === 'sac_historique') {
        try { await handleSacHistorique(interaction); } catch (err) {
          console.error('❌ Erreur sac_historique :', err);
          await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
        }
        return;
      }

      // Bouton saisir les secteurs (liste d'attente)
      if (interaction.customId === 'attente_saisir_zones') {
        try { await handleAttenteSaisirZones(interaction); } catch (err) {
          console.error('❌ Erreur attente_saisir_zones :', err);
          await interaction.update({ content: '❌ Une erreur est survenue.', components: [] }).catch(() => {});
        }
        return;
      }

      // Bouton "Voir la liste" du dashboard liste d'attente — éphémère
      if (interaction.customId.startsWith('attente_voir_')) {
        const type = interaction.customId.replace('attente_voir_', '');
        try {
          const db = getDB();
          const embed = await buildListeDetaillee(db, type);
          if (!embed) {
            return interaction.reply({ content: `📋 Aucun client en attente pour les **${type}s**.`, ephemeral: true });
          }
          return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
          console.error('❌ Erreur bouton attente_voir :', err);
          return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
      }

      // Bouton fermeture de ticket — accessible à tous, confirmation éphémère
      if (interaction.customId === 'ticket_fermer') {
        try {
          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_fermer_confirmer')
              .setLabel('Fermer')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('ticket_fermer_annuler')
              .setLabel('Annuler')
              .setStyle(ButtonStyle.Secondary),
          );
          await interaction.reply({
            content: '❓ Êtes-vous sûr de vouloir fermer ce ticket ?',
            components: [confirmRow],
            ephemeral: true,
          });
        } catch (err) {
          console.error('❌ Erreur demande fermeture ticket :', err);
        }
        return;
      }

      // Bouton annulation fermeture — met à jour le message éphémère
      if (interaction.customId === 'ticket_fermer_annuler') {
        await interaction.update({ content: '✅ Action annulée.', components: [] });
        return;
      }

      // Bouton confirmation fermeture — éjecte le(s) client(s) et envoie les contrôles agents
      if (interaction.customId === 'ticket_fermer_confirmer') {
        const member  = interaction.member;
        const channel = interaction.channel;
        try {
          // Trouver tous les membres (pas les rôles) qui ont un accès ViewChannel explicite
          // = le ou les clients qui ont ouvert ce ticket
          const memberOverwrites = channel.permissionOverwrites.cache.filter(
            ow => ow.type === 1 && ow.allow.has('ViewChannel'),
          );

          const clientIds = [];
          for (const [id] of memberOverwrites) {
            await channel.permissionOverwrites.edit(id, { ViewChannel: false }).catch(() => {});
            clientIds.push(id);
          }
          // Fallback si aucun overwrite individuel trouvé
          if (!clientIds.length) {
            await channel.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
            clientIds.push(member.id);
          }

          // Mettre à jour le message éphémère
          await interaction.update({ content: '🔒 Ticket fermé.', components: [] });

          // Embed "Ticket fermé"
          const embedFerme = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setDescription(`Ce ticket a été fermé par ${member}.`)
          // Embed "Support team ticket controls"
          const embedControls = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle('``Support team ticket controls``');

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              // On encode tous les IDs client séparés par une virgule
              .setCustomId(`ticket_reouvrir_${clientIds.join(',')}`)
              .setLabel('🔓Ré-ouvrir le ticket')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('ticket_supprimer')
              .setLabel('⛔Supprimer')
              .setStyle(ButtonStyle.Secondary),
          );

          await channel.send({ embeds: [embedFerme, embedControls], components: [controlRow] });
          await channel.setName('closed').catch(console.error);
        } catch (err) {
          console.error('❌ Erreur fermeture ticket :', err);
        }
        return;
      }

      // Bouton ré-ouverture — remet l'accès au(x) client(s) (agents uniquement)
      if (interaction.customId.startsWith('ticket_reouvrir_')) {
        const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
        if (!aAcces) {
          return interaction.reply({ content: '❌ Seuls les agents peuvent ré-ouvrir un ticket.', ephemeral: true });
        }
        // Peut contenir plusieurs IDs séparés par des virgules
        const memberIds = interaction.customId.replace('ticket_reouvrir_', '').split(',');
        try {
          for (const memberId of memberIds) {
            await interaction.channel.permissionOverwrites.edit(memberId, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
            });
          }
          const mentions = memberIds.map(id => `<@${id}>`).join(', ');
          await interaction.reply({ content: `✅ Ticket ré-ouvert. ${mentions} ${memberIds.length > 1 ? 'ont' : 'a'} de nouveau accès au salon.` });
        } catch (err) {
          console.error('❌ Erreur ré-ouverture ticket :', err);
          await interaction.reply({ content: '❌ Impossible de ré-ouvrir le ticket.', ephemeral: true });
        }
        return;
      }

      // Bouton suppression définitive — agents uniquement
      if (interaction.customId === 'ticket_supprimer') {
        const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
        if (!aAcces) {
          return interaction.reply({ content: '❌ Seuls les agents peuvent supprimer un ticket.', ephemeral: true });
        }
        try {
          await interaction.reply({ content: '🗑️ Suppression du ticket...' });
          setTimeout(() => interaction.channel.delete().catch(console.error), 3000);
        } catch (err) {
          console.error('❌ Erreur suppression ticket :', err);
        }
        return;
      }

      return;
    }

    // === SELECT MENUS ===
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'attente_sel_types') {
        try { await handleAttenteSelect(interaction); } catch (err) {
          console.error('❌ Erreur select attente :', err);
          await interaction.update({ content: '❌ Une erreur est survenue.', components: [] }).catch(() => {});
        }
        return;
      }
      if (interaction.customId === 'sac_donner_select') {
        try { await handleSacDonnerSelect(interaction); } catch (err) {
          console.error('❌ Erreur sac_donner_select :', err);
          await interaction.update({ content: '❌ Une erreur est survenue.', components: [] }).catch(() => {});
        }
        return;
      }
      if (interaction.customId === 'sac_retirer_select') {
        try { await handleSacRetirerSelect(interaction); } catch (err) {
          console.error('❌ Erreur sac_retirer_select :', err);
          await interaction.update({ content: '❌ Une erreur est survenue.', components: [] }).catch(() => {});
        }
        return;
      }
      return;
    }

    // === MODALS ===
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'attente_modal_zones') {
        try { await handleAttenteZonesModal(interaction); } catch (err) {
          console.error('❌ Erreur attente_modal_zones :', err);
          const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }
      if (interaction.customId.startsWith('annonce_modal_')) {
        try {
          await handleAnnonceModal(interaction);
        } catch (err) {
          console.error('❌ Erreur modal annonce :', err);
          const msg = { content: '❌ Une erreur est survenue lors de la création du ticket.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }
      if (interaction.customId === 'prepatchnote_modal') {
        try {
          await handlePrepatchnoteModal(interaction);
        } catch (err) {
          console.error('❌ Erreur modal prepatchnote :', err);
          const msg = { content: '❌ Une erreur est survenue lors de la publication.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }
      if (interaction.customId === 'embed_modal') {
        try {
          await handleEmbedModal(interaction);
        } catch (err) {
          console.error('❌ Erreur embed_modal :', err);
          const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }
      if (interaction.customId === 'recapsemaine_modal') {
        try {
          await handleRecapSemaineModal(interaction);
        } catch (err) {
          console.error('❌ Erreur recapsemaine_modal :', err);
          const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }
    }

    // === COMMANDES SLASH ===
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Commandes réservées à la Direction uniquement
    const CMDS_DIRECTION = ['prepatchnote', 'sac', 'embed'];
    if (CMDS_DIRECTION.includes(interaction.commandName)) {
      const isDirection = interaction.member.roles.cache.has('1375930527873368066');
      const isAdmin     = interaction.member.permissions.has(8n); // Administrator
      if (!isDirection && !isAdmin) {
        return interaction.reply({ content: '❌ Cette commande est réservée à la Direction.', ephemeral: true });
      }
    } else {
      // Toutes les autres commandes : Employé ou Direction
      const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
      if (!aAcces) {
        return interaction.reply({
          content: '❌ Tu dois avoir le rôle **Employé** ou **Direction** pour utiliser cette commande.',
          ephemeral: true,
        });
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erreur commande ${interaction.commandName}:`, error);
      const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};
