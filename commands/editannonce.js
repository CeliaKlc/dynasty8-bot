const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

const {
  AGENTS,
  BIENS,
  GARAGE_LABELS,
  GARAGE_LABEL_TO_VALUE,
  SALLE_A_SAC_LABELS,
  SALLE_A_SAC_LABEL_TO_VALUE,
  buildAnnonceContent,
} = require('../utils/annonceBuilder');

// ── Parse un message annonce existant ────────────────────────────────────────
function parseAnnonceMessage(content, components) {
  // Numéro et agentId depuis le customId du bouton Acheter
  const btn         = components?.[0]?.components?.[0];
  const rawCustomId = btn?.customId ?? '';
  // format: annonce_acheter_${numero}_${agentId}
  const customParts = rawCustomId.replace('annonce_acheter_', '').split('_');
  const agentId     = customParts.length > 1 ? customParts[customParts.length - 1] : null;
  const numero      = customParts.slice(0, customParts.length - 1).join('_') || rawCustomId.replace('annonce_acheter_', '') || null;

  // Transaction
  const transaction = content.includes('À VENDRE') ? 'vente' : 'location';

  // Type — cherche le nom de bien connu dans la ligne de titre (supporte bien.titre)
  const titleMatch = content.match(/✨ \*\*(?:À VENDRE|À LOUER) : (.+?)\*\* ✨/);
  const titlePart  = titleMatch ? titleMatch[1] : '';

  const matchingTypes = Object.keys(BIENS).filter(t => {
    const displayName = BIENS[t].titre ?? t;
    return titlePart === displayName || titlePart.startsWith(displayName + ' ');
  });

  let type = matchingTypes[0] ?? null;

  // Disambiguïser les variantes Duplex selon la présence du frigo dans le stockage
  if (matchingTypes.length > 1) {
    const hasFrigo = content.includes('dans le frigo');
    type = matchingTypes.find(t => (BIENS[t].frigo > 0) === hasFrigo) ?? matchingTypes[0];
  }

  // Quartier
  const quartierMatch = content.match(/📍 \*\*Emplacement :\*\* Situé (.+)/);
  const quartier      = quartierMatch ? quartierMatch[1].trim() : null;

  // ── Garages depuis LES + ──
  // Gère les deux formats : "Garage X places" (seul) et "N × Garages X places" (groupé)
  const isTypeLuxe = type === 'Villa de Luxe' || type === 'Maison de Luxe';
  const luxeMatch  = content.match(/> 🚗 (\d+) × Garage 10 places de luxe/);
  const garageLuxe = luxeMatch ? parseInt(luxeMatch[1]) : null;

  const garagesParses = [];
  if (!isTypeLuxe) {
    for (const m of content.matchAll(/> 🚗 (?:(\d+) × Garages|Garage) (.+)/g)) {
      const count = m[1] ? parseInt(m[1]) : 1;
      const val   = GARAGE_LABEL_TO_VALUE[m[2].trim()];
      if (val) for (let i = 0; i < count; i++) garagesParses.push(val);
    }
  }
  const garage1 = garagesParses[0] ?? null;
  const garage2 = garagesParses[1] ?? null;

  // Salle à sac
  const sacMatch  = content.match(/> 🎒 (.+)/);
  const salleASac = sacMatch ? SALLE_A_SAC_LABEL_TO_VALUE[sacMatch[1].trim()] ?? null : null;

  // Booléens / entiers
  const jardin   = content.includes('> 🌿 Jardin');
  const terrasseMatch = content.match(/> ☀️ (?:(\d+) Terrasses|Terrasse)/);
  const terrasse      = terrasseMatch ? (terrasseMatch[1] ? parseInt(terrasseMatch[1]) : 1) : null;
  const piscine  = content.includes('> 🏊 Piscine');

  const balconMatch = content.match(/> 🌅 (?:(\d+) Balcons|Balcon)/);
  const balcon      = balconMatch ? (balconMatch[1] ? parseInt(balconMatch[1]) : 1) : null;

  // Étagères (Entrepôt)
  const etagMatch = content.match(/dispose de \*\*(\d+) étagère/);
  const etageres  = etagMatch ? parseInt(etagMatch[1]) : null;

  // Description
  const descMatch   = content.match(/\*\*📝 DÉTAILS\*\*\n(?:> 👜 Peut posséder une salle à sac\n)?> (?!👜 Peut posséder une salle à sac)(.+)/);
  const description = descMatch ? descMatch[1].trim() : null;

  return { numero, agentId, transaction, type, quartier, garage1, garage2, garageLuxe, salleASac, jardin, piscine, terrasse, balcon, etageres, description };
}

// ── Commande ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('editannonce')
    .setDescription('✏️ Modifier les options d\'une annonce déjà publiée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt
      .setName('message_id')
      .setDescription('ID du message à modifier (clic droit → Copier l\'identifiant)')
      .setRequired(true))
    .addStringOption(opt => {
      opt.setName('agent').setDescription('Nouvel agent en charge de l\'annonce').setRequired(false);
      AGENTS.forEach(a => opt.addChoices({ name: a.name, value: a.id }));
      return opt;
    })
    .addStringOption(opt => {
      opt.setName('type').setDescription('Type de bien').setRequired(false);
      Object.keys(BIENS).forEach(t => opt.addChoices({ name: t, value: t }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('image')
      .setDescription('URL de l\'image à afficher sur l\'annonce (laisser vide = conserver)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('quartier')
      .setDescription('Nouveau quartier / emplacement')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('garage_1')
      .setDescription('1er garage inclus')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',                       value: '2'    },
        { name: '🚗 6 places',                       value: '6'    },
        { name: '🚗 10 places',                      value: '10'   },
        { name: '🚗 10 places de luxe',              value: '10l'  },
        { name: '🚗 26 places (Agence uniquement)',   value: '26'   },
        { name: '🚗 Loft Garage',                    value: 'loft' },
        { name: '❌ Supprimer',                       value: 'none' },
      ))
    .addStringOption(opt => opt
      .setName('garage_2')
      .setDescription('2ème garage inclus')
      .setRequired(false)
      .addChoices(
        { name: '🚗 2 places',                       value: '2'    },
        { name: '🚗 6 places',                       value: '6'    },
        { name: '🚗 10 places',                      value: '10'   },
        { name: '🚗 10 places de luxe',              value: '10l'  },
        { name: '🚗 26 places (Agence uniquement)',   value: '26'   },
        { name: '🚗 Loft Garage',                    value: 'loft' },
        { name: '❌ Supprimer',                       value: 'none' },
      ))
    .addIntegerOption(opt => opt
      .setName('garage_luxe')
      .setDescription('Garages de luxe (Villa/Maison de Luxe uniquement, 1 à 4)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(4))
    .addStringOption(opt => opt
      .setName('salle_a_sac')
      .setDescription('Salle à sac')
      .setRequired(false)
      .addChoices(
        { name: '🎒 Salle à sac',                value: '1'    },
        { name: '🎒 Salle à sac + 1 extension',  value: '2'    },
        { name: '🎒 Salle à sac + 2 extensions', value: '3'    },
        { name: '❌ Supprimer',                   value: 'none' },
      ))
    .addBooleanOption(opt => opt
      .setName('jardin')
      .setDescription('Jardin inclus ?')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('piscine')
      .setDescription('Piscine incluse ?')
      .setRequired(false))
    .addIntegerOption(opt => opt
      .setName('terrasse')
      .setDescription('Nombre de terrasses (0 pour supprimer)')
      .setRequired(false)
      .setMinValue(0))
    .addIntegerOption(opt => opt
      .setName('balcon')
      .setDescription('Nombre de balcons (0 pour supprimer)')
      .setRequired(false)
      .setMinValue(0))
    .addIntegerOption(opt => opt
      .setName('etageres')
      .setDescription('Étagères Entrepôt uniquement (1 à 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description libre')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');

    // Récupération du message
    let message;
    try {
      message = await interaction.channel.messages.fetch(messageId);
    } catch {
      return interaction.editReply({ content: '❌ Message introuvable. Utilise la commande dans le même salon que l\'annonce.' });
    }

    if (message.author.id !== interaction.client.user.id) {
      return interaction.editReply({ content: '❌ Ce message n\'a pas été envoyé par le bot.' });
    }

    // Parse les valeurs existantes
    const current = parseAnnonceMessage(message.content, message.components);

    if (!current.type || !current.quartier || !current.numero) {
      return interaction.editReply({ content: '❌ Impossible de lire ce message. Assure-toi que c\'est bien une annonce Dynasty 8.' });
    }

    // Fusion : valeur 'none' = supprimer l'option, null = conserver l'existante
    const resolveStr = (key, currentVal) => {
      const val = interaction.options.getString(key);
      if (val === 'none') return null;
      return val ?? currentVal;
    };

    const newType  = interaction.options.getString('type') ?? current.type;
    const imageUrl = interaction.options.getString('image');

    const merged = {
      numero:      current.numero,
      type:        newType,
      transaction: current.transaction,
      quartier:    interaction.options.getString('quartier') ?? current.quartier,
      garage1:     resolveStr('garage_1',   current.garage1),
      garage2:     resolveStr('garage_2',   current.garage2),
      garageLuxe:  interaction.options.getInteger('garage_luxe') ?? current.garageLuxe,
      salleASac:   resolveStr('salle_a_sac', current.salleASac),
      jardin:      interaction.options.getBoolean('jardin')   ?? current.jardin,
      piscine:     interaction.options.getBoolean('piscine')  ?? current.piscine,
      terrasse:    interaction.options.getInteger('terrasse') ?? current.terrasse,
      balcon:      interaction.options.getInteger('balcon')   ?? current.balcon,
      etageres:    interaction.options.getInteger('etageres') ?? current.etageres,
      description: interaction.options.getString('description') ?? current.description,
    };

    // Reconstruction du contenu via l'utilitaire partagé (même logique que /annonce)
    const newContent = buildAnnonceContent(merged);

    // Reconstruction des boutons
    const newAgentId = interaction.options.getString('agent') ?? current.agentId;
    const suffix = newAgentId ? `${current.numero}_${newAgentId}` : current.numero;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`annonce_acheter_${suffix}`)
        .setLabel('🏠 Acheter ce bien')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`annonce_visiter_${suffix}`)
        .setLabel('👁️ Visiter le bien')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('annonce_notif')
        .setLabel('🔔 Être notifié des prochaines annonces')
        .setStyle(ButtonStyle.Secondary),
    );

    const editPayload = { content: newContent, components: [row], allowedMentions: { parse: ['roles'] } };
    if (imageUrl !== null) {
      editPayload.files       = [imageUrl];
      editPayload.attachments = [];
    }
    await message.edit(editPayload);
    await interaction.editReply({ content: '✅ Annonce mise à jour !' });
  },
};
