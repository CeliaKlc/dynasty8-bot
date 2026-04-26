// ─── Historique des actions ───────────────────────────────────────────────────
// Enregistre chaque action significative dans la collection `action_logs`.
// Toujours appeler dans un try/catch — ne doit jamais faire planter l'action.

const { getDB } = require('./db');

// Icônes par type d'action (utilisées côté panel web)
const ACTION_META = {
  recap_lbc:       { icon: '📋', label: 'Récap LBC créé'          },
  vente_cloture:   { icon: '✅', label: 'Vente confirmée'          },
  attente_add:     { icon: '➕', label: 'Client ajouté en attente' },
  attente_remove:  { icon: '❌', label: 'Client retiré'            },
  attente_update:  { icon: '✏️', label: 'Fiche client mise à jour' },
  recap_semaine:   { icon: '📣', label: 'Récap semaine publié'     },
  agent_create:    { icon: '👤', label: 'Agent créé'               },
  agent_update:    { icon: '📝', label: 'Agent modifié'            },
  agent_delete:    { icon: '🗑️', label: 'Agent supprimé'           },
  sac_donner:      { icon: '🎒', label: 'Sac(s) attribué(s)'       },
  sac_retirer:     { icon: '📤', label: 'Sac(s) retiré(s)'         },
};

/**
 * @param {object} opts
 * @param {string} opts.type        — clé d'ACTION_META
 * @param {string} opts.actorId     — Discord ID de l'agent (ou 'web')
 * @param {string} opts.actorName   — Nom affiché au moment de l'action
 * @param {object} [opts.details]   — Données libres liées à l'action
 */
async function logAction({ type, actorId, actorName, details = {} }) {
  try {
    const meta = ACTION_META[type] ?? { icon: '🔔', label: type };
    await getDB().collection('action_logs').insertOne({
      type,
      icon:      meta.icon,
      label:     meta.label,
      actorId,
      actorName,
      details,
      createdAt: new Date(),
    });
  } catch (err) {
    // Ne jamais interrompre le flux principal
    console.error('[LOG] Erreur action_logs :', err.message);
  }
}

module.exports = { logAction, ACTION_META };
