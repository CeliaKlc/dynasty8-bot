const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const THREAD_NAME = '📝 Notes internes';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('📝 Ajouter une note interne (visible uniquement par les agents)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt
      .setName('contenu')
      .setDescription('Contenu de la note interne')
      .setRequired(true)
    )
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Le client concerné (optionnel)')
      .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const contenu = interaction.options.getString('contenu');
    const clientUser = interaction.options.getUser('client');
    const channel = interaction.channel;

    // Récupérer ou créer le fil privé dans ce salon
    let thread = channel.threads.cache.find(
      t => t.name === THREAD_NAME && !t.archived
    );

    if (!thread) {
      try {
        thread = await channel.threads.create({
          name: THREAD_NAME,
          type: ChannelType.PrivateThread,
          invitable: false,
          reason: 'Fil de notes internes agents Dynasty 8',
        });
      } catch (err) {
        console.error('[NOTE] Impossible de créer le fil privé :', err.message);
        return interaction.editReply({
          content: '❌ Impossible de créer le fil privé. Vérifie que le bot a la permission **Gérer les fils** dans ce salon.',
        });
      }
    }

    // Poster la note dans le fil
    const noteEmbed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('📝 Note interne')
      .addFields(
        ...(clientUser ? [{ name: '👤 Client', value: `<@${clientUser.id}> (${clientUser.username})`, inline: true }] : []),
        { name: '✍️ Agent', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🗒️ Note', value: contenu, inline: false },
      )
      .setFooter({ text: 'Dynasty 8 • Notes internes — visible agents uniquement' })
      .setTimestamp();

    await thread.send({ embeds: [noteEmbed] });

    // Confirmation éphémère
    return interaction.editReply({
      content: `✅ Note ajoutée dans le fil **${THREAD_NAME}** de ce ticket.`,
    });
  },
};
