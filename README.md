# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière fictive | Serveur Baylife RP

Bot Discord dédié à l'agence immobilière **Dynasty 8** sur le serveur GTA RP **Baylife RP**.
Il centralise la gestion des annonces LBC, des récapitulatifs de vente, des tickets clients, des rendez-vous agents et des cartes de visite.

---

## 📋 Vue d'ensemble des commandes

| Commande | Description | Accès |
|---|---|---|
| `/annonce` | Publier une annonce immobilière avec tickets automatiques | Employé / Direction |
| `/editannonce` | Modifier une annonce déjà publiée | Employé / Direction |
| `/recaplbc` | Créer un récapitulatif de vente LBC | Employé / Direction |
| `/editrecaplbc` | Modifier un récap LBC déjà envoyé | Employé / Direction |
| `/rename` | Renommer un salon ticket | Employé / Direction |
| `/renameannonce` | Renommer un salon annonce | Employé / Direction |
| `/reduc` | Publier une offre de réduction temporaire | Employé / Direction |
| `/rdv créer` | Planifier un rendez-vous avec rappels automatiques | Employé / Direction |
| `/rdv liste` | Voir tous les rendez-vous à venir | Employé / Direction |
| `/rdv annuler` | Annuler un rendez-vous planifié | Employé / Direction |
| `/sacha` `/ely` `/marco` … | Afficher la carte de visite d'un agent | Tous |
| `/prepatchnote` | Publier un pré-patchnote dans le salon dédié | Direction uniquement |

---

## 🏠 `/annonce`

Publie une annonce immobilière formatée dans le salon courant, avec un ping automatique du rôle `@Notification-LBC`.

Le message généré est structuré en 4 sections : **STOCKAGE**, **INTÉRIEUR**, **LES +**, et optionnellement **DÉTAILS**. Le stockage et les caractéristiques intérieures sont remplis automatiquement selon le type de bien sélectionné.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `numero` | texte | ✅ | Numéro de référence de l'annonce (ex : `1337`) |
| `type` | choix | ✅ | Type de bien — 22 choix (Appartement Simple, Villa, Entrepôt…) |
| `transaction` | choix | ✅ | `Vente` ou `Location` |
| `quartier` | texte | ✅ | Quartier ou adresse du bien |
| `image` | fichier | ✅ | Photo du bien |
| `agent` | choix | ✅ | Agent en charge de cette annonce (liste des 8 agents) |
| `garage_1` | choix | ❌ | 1er garage (2 / 6 / 10 / 10 luxe / 26 places / Loft) |
| `garage_2` | choix | ❌ | 2ème garage (mêmes choix) |
| `garage_luxe` | nombre | ❌ | Garages 10 places de luxe — **Villa/Maison de Luxe uniquement** (1 à 4) |
| `salle_a_sac` | choix | ❌ | Salle à sac simple, +1 extension ou +2 extensions |
| `jardin` | booléen | ❌ | Jardin inclus |
| `piscine` | booléen | ❌ | Piscine incluse |
| `terrasse` | booléen | ❌ | Terrasse incluse |
| `etageres` | nombre | ❌ | Étagères — **Entrepôt uniquement** (1 à 25, 1 étagère = 600 unités) |
| `description` | texte | ❌ | Informations supplémentaires libres |

### Système de tickets

Chaque annonce publiée comporte deux boutons :

- **🏠 Acheter ce bien** / **👁️ Visiter le bien**

Quand un utilisateur clique, un **formulaire** s'ouvre (Nom Prénom, Téléphone, Disponibilités). À la soumission, un **salon ticket privé** est créé automatiquement :
- Nommé avec l'emoji de l'agent + `⌛` + numéro (ex : `🦊⌛𝟭𝟯𝟰𝟳_𝗔𝗰𝗵𝗲𝘁𝗲𝗿`)
- L'embed de bienvenue s'affiche avec les infos du client
- L'agent assigné est **pingé** avec un message d'assignation accordé à son genre

**Cycle de vie du ticket :**

| Action | Qui | Résultat |
|---|---|---|
| 🔒 Fermer le ticket | Client ou Agent | Confirmation éphémère (Fermer / Annuler) |
| Confirmer la fermeture | Client ou Agent | Client éjecté, embed de clôture envoyé |
| 🔓 Ré-ouvrir le ticket | Agents uniquement | Accès du client rétabli |
| ⛔ Supprimer | Agents uniquement | Salon supprimé après 3 secondes |

---

## ✏️ `/editannonce`

Modifie les options d'une annonce déjà publiée. Les valeurs non fournies sont **conservées automatiquement**.

```
/editannonce message_id:123456789 type:Villa quartier:Vinewood garage_1:6
```

| Option | Type | Description |
|---|---|---|
| `message_id` | texte | ID du message à modifier *(clic droit → Copier l'identifiant)* |
| `type` | choix | Changer le type de bien (met à jour l'intérieur et le stockage automatiquement) |
| `image` | texte (URL) | Remplacer l'image de l'annonce |
| `quartier` | texte | Modifier le quartier / emplacement |
| `garage_1` | choix | Modifier ou supprimer le 1er garage |
| `garage_2` | choix | Modifier ou supprimer le 2ème garage |
| `garage_luxe` | nombre | Modifier le nombre de garages de luxe |
| `salle_a_sac` | choix | Modifier ou supprimer la salle à sac |
| `jardin` | booléen | Activer / désactiver |
| `piscine` | booléen | Activer / désactiver |
| `terrasse` | booléen | Activer / désactiver |
| `etageres` | nombre | Modifier le nombre d'étagères |
| `description` | texte | Modifier la description |

---

## 📋 `/recaplbc`

Génère un récapitulatif de vente formaté avec les pièces jointes (GPS + carte d'identité). Supporte jusqu'à **3 biens** dans un seul récap.

| Option | Type | Requis | Description |
|---|---|---|---|
| `annonce` | texte | ✅ | Numéro d'annonce LBC |
| `prix_depart` | texte | ✅ | Prix de départ |
| `commission` | texte | ✅ | Commission |
| `type` | texte | ✅ | Type du 1er bien |
| `adresse` | texte | ✅ | Adresse du 1er bien |
| `frais_dossier` | booléen | ✅ | Frais de dossier effectués |
| `double_cles` | booléen | ✅ | Double clés effectué |
| `gps` | fichier | ✅ | Capture GPS |
| `carte_identite` | fichier | ✅ | Carte d'identité du client |
| `negociation` | texte | ❌ | Prix négocié (si pas : `N/A`) |
| `etage` | texte | ❌ | Étage (si pas : `N/A`) |
| `type_2` / `adresse_2` / `etage_2` | texte | ❌ | 2ème bien |
| `type_3` / `adresse_3` / `etage_3` | texte | ❌ | 3ème bien |
| `description` | texte | ❌ | Infos complémentaires |

---

## ✏️ `/editrecaplbc`

Modifie un récap LBC déjà envoyé. Seuls les champs fournis sont mis à jour, les pièces jointes sont préservées automatiquement.

```
/editrecaplbc message_id:123456789 prix_depart:220'000$ negociation:210'000$
```

---

## 🏷️ `/rename`

Renomme le salon ticket courant avec un format standardisé.

Exemple : `🦊✅𝟭𝟯𝟯𝟲_𝗦𝗮𝗹𝗼𝗻`

| Option | Type | Requis | Description |
|---|---|---|---|
| `agent` | choix | ✅ | Agent responsable |
| `statut` | choix | ✅ | `⌛ En attente` / `✅ Vendu` / `❓ Ne sais pas` / `❌ Fin de contrat` |
| `numero` | texte | ✅ | Numéro de l'annonce |
| `description` | texte | ❌ | Description libre |

---

## 🏷️ `/renameannonce`

Renomme un salon annonce avec un format standardisé.

Exemple : `✅┃𝟭𝟯𝟰𝟲┃𝗕𝘂𝗿𝗲𝗮𝘂_𝗗𝗲𝗹-𝗣𝗲𝗿𝗿𝗼`

| Option | Type | Requis | Description |
|---|---|---|---|
| `statut` | choix | ✅ | `✅ A vendre` ou `❌ Vendu` |
| `numero` | texte | ✅ | Numéro de référence |
| `type` | texte | ✅ | Type de bien |
| `secteur` | texte | ✅ | Secteur / quartier |

---

## 🔥 `/reduc`

Publie une annonce de réduction de prix temporaire avec ping `@Notification-LBC`. Le message est **automatiquement supprimé** après la durée choisie, même en cas de redémarrage du bot (persisté en MongoDB).

| Option | Type | Requis | Description |
|---|---|---|---|
| `prix` | texte | ✅ | Nouveau prix réduit |
| `duree` | choix | ✅ | 6h / 12h / 24h / 48h / 72h / 7 jours |

---

## 🪪 Cartes de visite (`/sacha`, `/ely`, `/marco`…)

Chaque agent dispose de sa propre commande slash qui affiche sa carte de visite sous forme d'embed Dynasty 8.

**Informations affichées :**
- Nom et grade
- Numéro de téléphone in-game
- Agrégations (spécialités)
- Photo (thumbnail)

### Agents disponibles

| Commande | Agent | Emoji | Grade |
|---|---|---|---|
| `/sacha` | Sacha Rollay | 🦊 | Patronne |
| `/ely` | Ely Rollay | 🦦 | — |
| `/marco` | Marco Romanov | 🐻 | — |
| `/john` | John Russet | 🦍 | — |
| `/joy` | Joy Lutz | 🐍 | — |
| `/hain` | Hain Ergy | 🐲 | — |
| `/maksim` | Maksim Anatolyevich | 🦁 | — |
| `/macafey` | John Macafey | 🐳 | — |

> Pour ajouter un agent : ouvre `commands/cartevisite.js` et ajoute une entrée dans `AGENTS`.

---

## 📋 `/prepatchnote`

Publie un pré-patchnote dans le salon dédié. **Réservé à la Direction.**

Un modal s'ouvre avec deux champs :
- **Version / Titre** (ex : `v1.3.0 — Cartes de visite & Tickets`)
- **Contenu** (jusqu'à 4000 caractères, markdown Discord supporté)

L'embed est publié dans le salon configuré avec le nom de l'auteur en footer.

---

## 📅 `/rdv`

Gère les rendez-vous agents/clients avec rappels automatiques.

### `/rdv créer`

| Option | Type | Requis | Description |
|---|---|---|---|
| `client` | mention | ✅ | Le client concerné |
| `date` | texte | ✅ | `aujourd'hui`, `demain`, ou `JJ/MM/AAAA` |
| `heure` | texte | ✅ | Format `18h30` ou `18:30` |
| `description` | texte | ❌ | Objet du rendez-vous |
| `rappel` | choix | ❌ | 15 min / 30 min (défaut) / 1h / À l'heure pile uniquement |

→ Ping des deux parties à la création, rappel avant l'heure et à l'heure pile.

### `/rdv liste` — Affiche tous les rendez-vous à venir triés par date.

### `/rdv annuler` — Annule un rendez-vous via son identifiant.

---

## 🚀 Installation

### Étape 1 — Créer le bot sur Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → nom : `Dynasty 8`
3. Onglet **Bot** → **Reset Token** → copie le token
4. Active dans **Privileged Gateway Intents** : `Server Members Intent` + `Message Content Intent`
5. **OAuth2 → URL Generator** → `bot` + `applications.commands`, permissions `Administrator` → invite le bot

### Étape 2 — Base de données MongoDB Atlas

1. Crée un cluster gratuit **M0** sur [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Database Access** → utilisateur avec mot de passe
3. **Network Access** → `0.0.0.0/0`
4. **Connect → Drivers** → copie l'URI `mongodb+srv://...`

### Étape 3 — Héberger sur Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Onglet **Variables** :

| Variable | Valeur |
|---|---|
| `TOKEN` | Token du bot Discord |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | ID du serveur Discord |
| `MONGODB_URI` | URI MongoDB Atlas |
| `TZ` | `Europe/Paris` |

> ⚠️ `TZ=Europe/Paris` est obligatoire pour les rappels de RDV.

### Étape 4 — IDs à configurer dans le code

**`commands/annonce.js`**
```js
const CATEGORIE_TICKETS_ID      = 'ID_CATEGORIE_TICKETS';
const ROLE_NOTIFICATIONS_LBC_ID = 'ID_ROLE_NOTIFICATIONS_LBC';
const ROLES_AUTORISES           = ['ID_ROLE_EMPLOYE', 'ID_ROLE_DIRECTION'];
```

**`commands/annonce.js` — Agents** (IDs Discord + emojis + genre) :
```js
const AGENTS = [
  { name: 'Sacha Rollay', id: 'ID_DISCORD', emoji: '🦊', feminin: true },
  // ...
];
```

**`commands/prepatchnote.js`**
```js
const SALON_PREPATCHNOTE_ID = 'ID_SALON_PREPATCHNOTE';
const ROLE_DIRECTION_ID     = 'ID_ROLE_DIRECTION';
```

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes. Les commandes slash prennent du temps à s'enregistrer.

**`@Notification-LBC` ne ping pas ?**
→ Vérifie `ROLE_NOTIFICATIONS_LBC_ID` dans `commands/annonce.js` et que le message est envoyé avec `allowedMentions: { parse: ['roles'] }`.

**L'agent n'est pas pingé à l'ouverture du ticket ?**
→ Vérifie que l'ID Discord de l'agent est bien renseigné dans `AGENTS` dans `commands/annonce.js`.

**Les rappels de RDV ne se déclenchent pas à la bonne heure ?**
→ Vérifie que `TZ=Europe/Paris` est défini dans Railway.

**MongoDB ne se connecte pas ?**
→ Vérifie l'URI dans `MONGODB_URI` et que `0.0.0.0/0` est autorisé dans Atlas Network Access.

**`/editannonce` ou `/editrecaplbc` ne trouve pas le message ?**
→ Utilise la commande dans **le même salon** que le message. Active le mode développeur pour copier les IDs.

**`/rename` — le salon ne se renomme pas ?**
→ Discord limite les renommages à **2 fois par 10 minutes** par salon.

---

*Dynasty 8 — Baylife RP*
