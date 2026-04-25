const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { formatPrix } = require('../utils/formatters');
const agentCache = require('../utils/agentCache');

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLE_EMPLOYE_ID = '917744433682849802';
const EMOJI_DYNASTY   = '<:Dynasty8:963035929042386984>';
const JOURS_FR        = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const AGENT_BY_ID = () => Object.fromEntries(agentCache.getAll().filter(a => a.id).map(a => [a.id, a]));
const PATRONS_IDS = new Set(['314057285523472394', '261956403546161152', '1151865005239697449']);

const PALMARES_CONFIG = [
  { key: 'cdp',     roleId: '1474245640711180417', bonus: "25'000$" },
  { key: 'vendeur', roleId: '1474245431784374377', bonus: "15'000$" },
  { key: 'loueur',  roleId: '1474245575762509981', bonus: "20'000$" },
];

const ROLES_RECHERCHES_DEFAUT = ['1045639426170167358', '1437091436406247516'];

const GRADES_CHOICES = [
  { name: 'Agent Débutant', value: 'Agent Débutant' },
  { name: 'Agent',          value: 'Agent'          },
  { name: 'Agent Confirmé', value: 'Agent Confirmé' },
  { name: 'Agent Senior',   value: 'Agent Senior'   },
  { name: 'Responsable',    value: 'Responsable'    },
  { name: 'Co-Patron',      value: 'Co-Patron'      },
  { name: 'Patron',         value: 'Patron'         },
];

const GRADE_ROLE_IDS = {
  'Agent Débutant': '915924696179032085',
  'Agent':          '915924519192002590',
  'Agent Confirmé': '945712412030566411',
  'Agent Senior':   '1463560118040924343',
  'Responsable':    '915697206173007902',
  'Co-Patron':      '1436830592137302026',
  'Patron':         '814920310251454484',
};

// Données en attente entre commande et modal (TTL 5 min)
const pendingData = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRecap() {
  const now  = new Date();
  const jour = JOURS_FR[now.getDay()];
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${jour} ${dd}/${mm}/${yyyy}`;
}

function blockquoteLines(text) {
  const lines = text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    return t.startsWith('>') ? t : `> ${t}`;
  });
  while (lines.length && lines[0] === '')                lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// ─── Construction du message ──────────────────────────────────────────────────

function buildRecap({ informations, departs, felicitations, chiffres, top3, data }) {
  const parts = [];

  // En-tête
  parts.push(`### __**Récapitulatif du ${dateRecap()} :**__\n`);
  parts.push('**On vous remercie pour votre investissement une fois de plus.**');

  // ── Informations / Nouveautés / Avertissements ────────────────────────────
  if (informations?.trim()) {
    const sections = { INFO: [], NOUVEAU: [], AVERT: [] };
    for (const raw of informations.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if      (/^info\s*:/i.test(line))    sections.INFO.push(line.replace(/^info\s*:\s*/i, ''));
      else if (/^nouveau\s*:/i.test(line)) sections.NOUVEAU.push(line.replace(/^nouveau\s*:\s*/i, ''));
      else if (/^avert\s*:/i.test(line))   sections.AVERT.push(line.replace(/^avert\s*:\s*/i, ''));
      else                                  sections.INFO.push(line);
    }
    const LABELS = { INFO: '__**Information :**__', NOUVEAU: '__**Nouveauté :**__', AVERT: '__**Avertissement :**__' };
    for (const [key, label] of Object.entries(LABELS)) {
      if (!sections[key].length) continue;
      parts.push(`\n${label}\n`);
      parts.push(sections[key].map(t => `> ${t}`).join('\n'));
    }
  }

  // ── Départ ────────────────────────────────────────────────────────────────
  if (departs?.trim()) {
    parts.push(`\n__**Départ :**__\n\n> ${departs.trim()}`);
  }

  // ── Arrivée ───────────────────────────────────────────────────────────────
  if (data.arrivee) {
    const gradeArrivee = data.arrivee_grade
      ? ` en tant qu'<@&${GRADE_ROLE_IDS[data.arrivee_grade]}>`
      : '';
    parts.push(`\n__**Arrivée :**__\n\n> Arrivé de <@${data.arrivee}>${gradeArrivee}`);
  }

  // ── Félicitations ─────────────────────────────────────────────────────────
  // On construit d'abord toutes les lignes structurées (palmarès + promotions),
  // puis on leur affecte les suffixes , / . dynamiquement.
  {
    const items = []; // lignes sans suffixe

    // Palmarès (CDP / VENDEUR / LOUEUR)
    for (const cfg of PALMARES_CONFIG) {
      const agentId = data[cfg.key];
      if (!agentId) continue;
      const agent       = AGENT_BY_ID()[agentId];
      const roleDisplay = `<@&${cfg.roleId}>`;
      if (PATRONS_IDS.has(agentId)) {
        const label = agent?.feminin ? 'patronne' : 'patron';
        items.push(`> <@${agentId}> qui est ${roleDisplay} et reçoit **rien car ${label}**`);
      } else {
        items.push(`> <@${agentId}> qui est ${roleDisplay} et reçoit **+ ${cfg.bonus} supplémentaire**`);
      }
    }

    // Promotions de grade (fel_1 / fel_2 / fel_3)
    for (let i = 1; i <= 3; i++) {
      const agentId = data[`fel_${i}_agent`];
      const grade   = data[`fel_${i}_grade`];
      if (!agentId || !grade) continue;
      const gradeDisplay = GRADE_ROLE_IDS[grade] ? `<@&${GRADE_ROLE_IDS[grade]}>` : `**${grade}**`;
      items.push(`> <@${agentId}> qui passe ${gradeDisplay}`);
    }

    // Ajout des suffixes , / . selon la position
    const structuredLines = items.map((line, i) =>
      `${line}${i < items.length - 1 ? ' ,' : '.'}`,
    );

    // Félicitations libres (modal)
    const customLines = felicitations?.trim() ? blockquoteLines(felicitations) : [];

    if (structuredLines.length || customLines.length) {
      parts.push(`\n__**Félicitations à :**__\n`);
      if (customLines.length) parts.push(customLines.join('\n'));
      if (customLines.length && structuredLines.length) parts.push('');
      if (structuredLines.length) parts.push(structuredLines.join('\n'));
    }
  }

  // ── Quelques chiffres ─────────────────────────────────────────────────────
  if (chiffres?.trim()) {
    const [ca = '', primes = '', benef = ''] = chiffres.split('|').map(s => s.trim());
    parts.push(
      `\n__**Quelques chiffres : **__\n` +
      `Chiffre d'affaires : **${formatPrix(ca) || ca}$**\n` +
      `Montant total des primes : **${formatPrix(primes) || primes}$**\n` +
      `Bénéfices : **${formatPrix(benef) || benef}$**`,
    );
  }

  // ── Top 3 ─────────────────────────────────────────────────────────────────
  if (top3?.trim()) {
    const top3Lines = top3.split('\n').map(l => l.trim()).filter(Boolean);
    if (top3Lines.length) {
      parts.push('\n__**Top 3 des services les plus vendus**__');
      top3Lines.slice(0, 3).forEach((line, i) => {
        const spaceIdx = line.indexOf(' ');
        const count   = spaceIdx > -1 ? line.slice(0, spaceIdx) : line;
        const service = spaceIdx > -1 ? line.slice(spaceIdx + 1).trim() : '';
        parts.push(`- **Top ${i + 1} : ${count}** **${service}**`);
      });
    }
  }

  // ── Rôles cherchés ────────────────────────────────────────────────────────
  // 2 rôles par défaut + 1 rôle supplémentaire (option slash)
  {
    const allRoles = ROLES_RECHERCHES_DEFAUT.map(id => `<@&${id}>`);
    if (data.role_sup) allRoles.push(`<@&${data.role_sup}>`);

    parts.push('\n__**Rôle que nous cherchons encore :**__');
    allRoles.forEach((r, i) => {
      parts.push(`- ${r}${i < allRoles.length - 1 ? ',' : '.'}`);
    });
  }

  // Pied de page
  parts.push(
    "\n*Les salaires sont versés sur place, n'hésitez pas à vous manifester pour votre prime !*\n",
  );
  parts.push(`Merci à vous <@&${ROLE_EMPLOYE_ID}>. 🫶 ${EMOJI_DYNASTY}`);

  return parts.join('\n');
}

// ─── Commande ─────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recapsemaine')
    .setDescription('Publier le récapitulatif hebdomadaire Dynasty 8')

    // Destination
    .addChannelOption(opt => opt
      .setName('salon')
      .setDescription('Salon de publication (défaut : salon actuel)')
      .setRequired(false))

    // Palmarès
    .addStringOption(opt => {
      opt.setName('cdp').setDescription('🧸 Meilleur CDP').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => {
      opt.setName('vendeur').setDescription('🧸 Meilleur Vendeur').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => {
      opt.setName('loueur').setDescription('🧸 Meilleur Loueur').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })

    // RH
    .addStringOption(opt => {
      opt.setName('arrivee').setDescription('Nouvelle arrivée').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('arrivee_grade')
      .setDescription('Grade de la nouvelle arrivée')
      .setRequired(false)
      .addChoices(...GRADES_CHOICES))

    // Rôle supplémentaire
    .addRoleOption(opt => opt
      .setName('role_sup')
      .setDescription('Rôle supplémentaire recherché (en plus des 2 par défaut)')
      .setRequired(false))

    // Félicitations 1
    .addStringOption(opt => {
      opt.setName('fel_1_agent').setDescription('Félicitation 1 — Agent').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('fel_1_grade')
      .setDescription('Félicitation 1 — Grade obtenu')
      .setRequired(false)
      .addChoices(...GRADES_CHOICES))

    // Félicitations 2
    .addStringOption(opt => {
      opt.setName('fel_2_agent').setDescription('Félicitation 2 — Agent').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('fel_2_grade')
      .setDescription('Félicitation 2 — Grade obtenu')
      .setRequired(false)
      .addChoices(...GRADES_CHOICES))

    // Félicitations 3
    .addStringOption(opt => {
      opt.setName('fel_3_agent').setDescription('Félicitation 3 — Agent').setRequired(false);
      agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
      return opt;
    })
    .addStringOption(opt => opt
      .setName('fel_3_grade')
      .setDescription('Félicitation 3 — Grade obtenu')
      .setRequired(false)
      .addChoices(...GRADES_CHOICES)),

  async execute(interaction) {
    const o = interaction.options;
    const data = {
      channelId:    o.getChannel('salon')?.id  ?? interaction.channelId,
      cdp:          o.getString('cdp')          ?? null,
      vendeur:      o.getString('vendeur')      ?? null,
      loueur:       o.getString('loueur')       ?? null,
      arrivee:      o.getString('arrivee')      ?? null,
      arrivee_grade: o.getString('arrivee_grade') ?? null,
      role_sup:     o.getRole('role_sup')?.id   ?? null,
      fel_1_agent:  o.getString('fel_1_agent')  ?? null,
      fel_1_grade:  o.getString('fel_1_grade')  ?? null,
      fel_2_agent:  o.getString('fel_2_agent')  ?? null,
      fel_2_grade:  o.getString('fel_2_grade')  ?? null,
      fel_3_agent:  o.getString('fel_3_agent')  ?? null,
      fel_3_grade:  o.getString('fel_3_grade')  ?? null,
    };
    pendingData.set(interaction.user.id, data);
    setTimeout(() => pendingData.delete(interaction.user.id), 5 * 60 * 1000);

    const modal = new ModalBuilder()
      .setCustomId('recapsemaine_modal')
      .setTitle('Récapitulatif de la semaine');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('informations')
          .setLabel('Infos · Nouveautés · Avertissements')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('INFO: texte...\nNOUVEAU: texte...\nAVERT: texte...')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('departs')
          .setLabel('Départs')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Sacha Rollay, Ely Rollay et de Marco Romanov')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('felicitations')
          .setLabel('Félicitations libres (texte personnalisé)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Texte libre affiché sous les félicitations structurées...')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('chiffres')
          .setLabel('Chiffres : CA | Primes | Bénéfices')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('54089531 | 1781001 | 3297939')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('top3')
          .setLabel('Top 3 des services (3 lignes)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('60 SUD CDP\n21 Contrat de vente\n17 SUD LOCATION')
          .setRequired(false),
      ),
    );

    await interaction.showModal(modal);
  },

  // ─── Handler modal ───────────────────────────────────────────────────────

  async handleRecapSemaineModal(interaction) {
    const data = pendingData.get(interaction.user.id) ?? { channelId: interaction.channelId };
    pendingData.delete(interaction.user.id);

    const content = buildRecap({
      informations:  interaction.fields.getTextInputValue('informations'),
      departs:       interaction.fields.getTextInputValue('departs'),
      felicitations: interaction.fields.getTextInputValue('felicitations'),
      chiffres:      interaction.fields.getTextInputValue('chiffres'),
      top3:          interaction.fields.getTextInputValue('top3'),
      data,
    });

    try {
      const channel = await interaction.client.channels.fetch(data.channelId);
      await channel.send({ content, allowedMentions: { parse: ['roles', 'users'] } });

      await interaction.reply({
        content:   data.channelId === interaction.channelId
          ? '✅ Récapitulatif publié !'
          : `✅ Récapitulatif publié dans <#${data.channelId}> !`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('[RECAPSEMAINE] Erreur :', err);
      await interaction.reply({ content: '❌ Impossible de publier le récapitulatif.', ephemeral: true });
    }
  },
};
