const { handleAnnonceButton, handleAnnonceModal } = require('../commands/annonce');
const { handlePrepatchnoteModal } = require('../commands/prepatchnote');

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

      // Bouton fermeture de ticket — accessible à tous, confirmation éphémère
      if (interaction.customId === 'ticket_fermer') {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

      // Bouton confirmation fermeture — éjecte le client et envoie les contrôles agents
      if (interaction.customId === 'ticket_fermer_confirmer') {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const member  = interaction.member;
        const channel = interaction.channel;
        try {
          // Éjecter le client du salon
          await channel.permissionOverwrites.edit(member.id, { ViewChannel: false });

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
              .setCustomId(`ticket_reouvrir_${member.id}`)
              .setLabel('🔓Ré-ouvrir le ticket')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('ticket_supprimer')
              .setLabel('⛔Supprimer')
              .setStyle(ButtonStyle.Secondary),
          );

          await channel.send({ embeds: [embedFerme, embedControls], components: [controlRow] });
        } catch (err) {
          console.error('❌ Erreur fermeture ticket :', err);
        }
        return;
      }

      // Bouton ré-ouverture — remet l'accès au client (agents uniquement)
      if (interaction.customId.startsWith('ticket_reouvrir_')) {
        const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
        if (!aAcces) {
          return interaction.reply({ content: '❌ Seuls les agents peuvent ré-ouvrir un ticket.', ephemeral: true });
        }
        const memberId = interaction.customId.replace('ticket_reouvrir_', '');
        try {
          await interaction.channel.permissionOverwrites.edit(memberId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
          await interaction.reply({ content: `✅ Ticket ré-ouvert. <@${memberId}> a de nouveau accès au salon.` });
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

    // === MODALS ===
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('annonce_modal_')) {
        try {
          await handleAnnonceModal(interaction);
        } catch (err) {
          console.error('❌ Erreur modal annonce :', err);
          const msg = { content: '❌ Une erreur est survenue lors de la création du ticket.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
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
      }
      return;
    }

    // === COMMANDES SLASH ===
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // /prepatchnote réservé à la Direction uniquement
    if (interaction.commandName === 'prepatchnote') {
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
