const { SlashCommandBuilder } = require('discord.js');

// ── Reconstruction du contenu (même logique que recapLBC.js) ─────────────────
function buildContenu({ annonce, prixDepart, negociation, commission, type, adresse, etage, type2, adresse2, etage2, type3, adresse3, etage3, description, fraisDossier, doubleCles }) {
  const lignes = [
    `======= **Annonce LBC : ${annonce}** ========`,
    ``,
    `**Prix de départ :** ${prixDepart}$`,
  ];

  if (negociation) lignes.push(`**Négociation :** ${negociation}$`);

  lignes.push(`**Commission :** ${commission}%`);
  lignes.push(``);

  lignes.push(`**Type :** ${type}`);
  lignes.push(`**Adresse :** ${adresse}`);
  if (etage) lignes.push(`**Étage :** ${etage}`);

  if (type2) {
    lignes.push(``);
    lignes.push(`+`);
    lignes.push(``);
    lignes.push(`**Type :** ${type2}`);
    if (adresse2) lignes.push(`**Adresse :** ${adresse2}`);
    if (etage2)   lignes.push(`**Étage :** ${etage2}`);
  }

  if (type3) {
    lignes.push(``);
    lignes.push(`+`);
    lignes.push(``);
    lignes.push(`**Type :** ${type3}`);
    if (adresse3) lignes.push(`**Adresse :** ${adresse3}`);
    if (etage3)   lignes.push(`**Étage :** ${etage3}`);
  }

  lignes.push(``);
  if (description) {
    lignes.push(`**Description**`);
    lignes.push(`${description}`);
  }

  lignes.push(``);
  lignes.push(`**Frais de dossier :** ${fraisDossier ? '✅' : '❌'}`);
  lignes.push(`**Double clés effectué :** ${doubleCles ? '✅' : '❌'}`);

  return lignes.join('\n');
}

// ── Parsing du contenu existant ───────────────────────────────────────────────
function parseContenu(content) {
  const get = (pattern) => {
    const m = content.match(pattern);
    return m ? m[1].trim() : null;
  };

  const typeAll    = [...content.matchAll(/\*\*Type :\*\* (.+)/g)].map(m => m[1].trim());
  const adresseAll = [...content.matchAll(/\*\*Adresse :\*\* (.+)/g)].map(m => m[1].trim());
  const etageAll   = [...content.matchAll(/\*\*Étage :\*\* (.+)/g)].map(m => m[1].trim());

  // Description — ligne(s) suivant **Description**
  const descMatch  = content.match(/\*\*Description\*\*\n(.+)/);
  const description = descMatch ? descMatch[1].trim() : null;

  return {
    annonce:      get(/======= \*\*Annonce LBC : (.+?)\*\* ========/),
    // Capturer SANS le suffixe $ ou % pour éviter le doublement lors de la reconstruction
    prixDepart:   get(/\*\*Prix de départ :\*\* (.+?)\$/),
    negociation:  get(/\*\*Négociation :\*\* (.+?)\$/),
    commission:   get(/\*\*Commission :\*\* (.+?)%/),
    type:         typeAll[0]    ?? null,
    adresse:      adresseAll[0] ?? null,
    etage:        etageAll[0]   ?? null,
    type2:        typeAll[1]    ?? null,
    adresse2:     adresseAll[1] ?? null,
    etage2:       etageAll[1]   ?? null,
    type3:        typeAll[2]    ?? null,
    adresse3:     adresseAll[2] ?? null,
    etage3:       etageAll[2]   ?? null,
    description,
    fraisDossier: content.includes('**Frais de dossier :** ✅'),
    doubleCles:   content.includes('**Double clés effectué :** ✅'),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editrecaplbc')
    .setDescription('✏️ Modifier un récap LBC déjà envoyé')
    .addStringOption(opt => opt
      .setName('message_id')
      .setDescription('ID du message à modifier (clic droit sur le message → Copier l\'identifiant)')
      .setRequired(true))

    // ── Champs modifiables (tous optionnels) ──────────────────────────────────
    .addStringOption(opt => opt
      .setName('annonce')
      .setDescription('Nouveau numéro d\'annonce')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('prix_depart')
      .setDescription('Nouveau prix de départ (sans $)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('negociation')
      .setDescription('Nouveau prix de négociation (sans $)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('commission')
      .setDescription('Nouvelle commission (sans %)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Nouveau type du bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('adresse')
      .setDescription('Nouvelle adresse du bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('etage')
      .setDescription('Nouvel étage du bien')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('frais_dossier')
      .setDescription('Frais de dossier effectués ?')
      .setRequired(false))
    .addBooleanOption(opt => opt
      .setName('double_cles')
      .setDescription('Double clés effectué ?')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Nouvelle description')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('type_2')
      .setDescription('Nouveau type du 2ème bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('adresse_2')
      .setDescription('Nouvelle adresse du 2ème bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('etage_2')
      .setDescription('Nouvel étage du 2ème bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('type_3')
      .setDescription('Nouveau type du 3ème bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('adresse_3')
      .setDescription('Nouvelle adresse du 3ème bien')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('etage_3')
      .setDescription('Nouvel étage du 3ème bien')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');

    // ── Récupération du message ───────────────────────────────────────────────
    let message;
    try {
      message = await interaction.channel.messages.fetch(messageId);
    } catch {
      return interaction.editReply({
        content: '❌ Message introuvable. Assure-toi d\'utiliser la commande dans le même salon que le récap.',
      });
    }

    if (message.author.id !== interaction.client.user.id) {
      return interaction.editReply({ content: '❌ Ce message n\'a pas été envoyé par le bot.' });
    }

    // ── Fusion valeurs existantes + nouvelles ─────────────────────────────────
    const current = parseContenu(message.content);

    const merged = {
      annonce:      interaction.options.getString('annonce')      ?? current.annonce,
      prixDepart:   interaction.options.getString('prix_depart')  ?? current.prixDepart,
      negociation:  interaction.options.getString('negociation')  ?? current.negociation,
      commission:   interaction.options.getString('commission')   ?? current.commission,
      type:         interaction.options.getString('type')         ?? current.type,
      adresse:      interaction.options.getString('adresse')      ?? current.adresse,
      etage:        interaction.options.getString('etage')        ?? current.etage,
      type2:        interaction.options.getString('type_2')       ?? current.type2,
      adresse2:     interaction.options.getString('adresse_2')    ?? current.adresse2,
      etage2:       interaction.options.getString('etage_2')      ?? current.etage2,
      type3:        interaction.options.getString('type_3')       ?? current.type3,
      adresse3:     interaction.options.getString('adresse_3')    ?? current.adresse3,
      etage3:       interaction.options.getString('etage_3')      ?? current.etage3,
      description:  interaction.options.getString('description')  ?? current.description,
      fraisDossier: interaction.options.getBoolean('frais_dossier') ?? current.fraisDossier,
      doubleCles:   interaction.options.getBoolean('double_cles')   ?? current.doubleCles,
    };

    await message.edit({ content: buildContenu(merged) });
    await interaction.editReply({ content: '✅ Récap LBC modifié avec succès !' });
  },
};
