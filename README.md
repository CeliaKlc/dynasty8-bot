# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière | Baylife RP

---

## 📋 Commandes disponibles

| Commande | Description | Permission |
|---|---|---|
| `/annonce` | Publier une annonce immobilière (texte + boutons Acheter/Visiter) | Employé / Direction |
| `/recaplbc` | Créer un récap de vente LBC (prix, type, adresse, frais, clés, GPS, CI) | Employé / Direction |
| `/editrecaplbc` | Modifier un récap LBC déjà envoyé via son ID de message | Employé / Direction |
| `/rename` | Renommer un ticket avec agent, statut, numéro et description | Employé / Direction |
| `/rdv créer` | Planifier un rendez-vous avec un client (rappels automatiques) | Employé / Direction |
| `/rdv liste` | Voir tous les rendez-vous à venir | Employé / Direction |
| `/rdv annuler` | Annuler un rendez-vous planifié | Employé / Direction |

---

## 🏠 Commande `/annonce`

Publie une annonce immobilière formatée dans le salon courant avec un ping `@Notification-LBC`.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `numero` | texte | ✅ | Numéro de référence de l'annonce |
| `type` | choix | ✅ | Type de bien (22 choix disponibles) |
| `transaction` | choix | ✅ | Vente ou Location |
| `quartier` | texte | ✅ | Quartier / emplacement |
| `image` | fichier | ✅ | Photo du bien |
| `garage_1` | choix | ❌ | 1er garage inclus |
| `garage_2` | choix | ❌ | 2ème garage inclus |
| `garage_luxe` | nombre | ❌ | Garages luxe (Villa/Maison de Luxe uniquement, 1 à 4) |
| `salle_a_sac` | choix | ❌ | Salle à sac (simple / +1 ext / +2 ext) |
| `jardin` | booléen | ❌ | Jardin inclus |
| `piscine` | booléen | ❌ | Piscine incluse |
| `terrasse` | booléen | ❌ | Terrasse incluse |
| `etageres` | nombre | ❌ | Étagères Entrepôt uniquement (1 à 25) |
| `description` | texte | ❌ | Détails supplémentaires |

### Système de tickets

Quand un client clique sur **🏠 Acheter** ou **👁️ Visiter**, un formulaire s'ouvre avec :
- Nom Prénom
- Numéro de téléphone
- Disponibilités

Un salon ticket privé est créé automatiquement avec les infos du client. Dans ce salon :
- **🔒 Fermer le ticket** (client ou agent) → confirmation éphémère → éjecte le client
- **🔓 Ré-ouvrir le ticket** (agents uniquement) → remet l'accès au client
- **Supprimer** (agents uniquement) → supprime le salon

---

## 📋 Commande `/recaplbc`

Crée un récap de vente LBC formaté avec les pièces jointes.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `annonce` | texte | ✅ | Numéro d'annonce |
| `prix_depart` | texte | ✅ | Prix de départ |
| `commission` | texte | ✅ | Commission |
| `type` | texte | ✅ | Type du bien |
| `adresse` | texte | ✅ | Adresse du bien |
| `frais_dossier` | booléen | ✅ | Frais de dossier effectués |
| `double_cles` | booléen | ✅ | Double clés effectué |
| `gps` | fichier | ✅ | Capture GPS |
| `carte_identite` | fichier | ✅ | Carte d'identité du client |
| `negociation` | texte | ❌ | Prix de négociation |
| `etage` | texte | ❌ | Étage du bien |
| `type_2` | texte | ❌ | Type du 2ème bien (ajoute un `+` entre les deux) |
| `adresse_2` | texte | ❌ | Adresse du 2ème bien |
| `etage_2` | texte | ❌ | Étage du 2ème bien |

---

## ✏️ Commande `/editrecaplbc`

Modifie un récap LBC déjà envoyé. Seuls les champs fournis sont mis à jour, les autres sont conservés. Les pièces jointes (GPS, CI) sont automatiquement préservées.

```
/editrecaplbc message_id:123456789 prix_depart:220'000$
```

Pour obtenir l'ID du message : **clic droit sur le message → Copier l'identifiant** (mode développeur requis).

---

## 🚀 Installation

### ÉTAPE 1 — Créer le bot sur Discord

1. Va sur https://discord.com/developers/applications
2. Clique **"New Application"** → donne-lui le nom **"Dynasty 8"**
3. Va dans **"Bot"** → clique **"Reset Token"** → copie le token
4. Active ces options dans **"Privileged Gateway Intents"** :
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Va dans **"OAuth2"** → **"URL Generator"**
   - Coche : `bot` + `applications.commands`
   - Permissions : `Administrator`
   - Copie le lien et invite le bot sur ton serveur

---

### ÉTAPE 2 — Créer la base de données MongoDB Atlas (gratuit)

Les rendez-vous sont stockés sur MongoDB Atlas pour persister entre les redémarrages.

1. Crée un compte sur https://www.mongodb.com/atlas
2. Crée un **cluster gratuit M0**
3. Dans **Database Access** → ajoute un utilisateur avec un mot de passe
4. Dans **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. Dans **Connect** → **Drivers** → copie l'URI de connexion :
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
   ```

---

### ÉTAPE 3 — Héberger sur Railway

1. Crée un compte sur https://railway.app (connecte-toi avec GitHub)
2. Clique **"New Project"** → **"Deploy from GitHub repo"** → sélectionne ce dépôt
3. Dans Railway → onglet **"Variables"** → ajoute :

```
TOKEN           = (token de ton bot Discord)
CLIENT_ID       = (Application ID depuis le Developer Portal)
GUILD_ID        = (ID de ton serveur Discord)
CHANNEL_LOGS_ID = (ID du canal logs agents — optionnel)
MONGODB_URI     = (URI MongoDB Atlas avec user:password remplis)
TZ              = Europe/Paris
```

> ⚠️ La variable `TZ=Europe/Paris` est obligatoire pour que les rappels de RDV se déclenchent à la bonne heure.

4. Railway lance le bot automatiquement à chaque push sur la branche principale.

---

### ÉTAPE 4 — Configurer les agents dans `/rename`

Ouvre `commands/rename.js` et remplis les IDs Discord de chaque agent :

```js
const AGENTS = {
  '123456789012345678': '🦊',  // Sacha Rollay
  '234567890123456789': '🦦',  // Ely Rollay
  '345678901234567890': '🐻',  // Marco Romanov
};
```

Pour obtenir un ID : **Paramètres → Avancés → Mode développeur**, puis clic droit sur l'utilisateur → **Copier l'identifiant**.

---

### ÉTAPE 5 — Configurer les IDs dans `/annonce`

Ouvre `commands/annonce.js` et vérifie les constantes en haut du fichier :

```js
const CATEGORIE_TICKETS_ID       = 'ID_DE_LA_CATEGORIE_TICKETS';
const ROLE_NOTIFICATIONS_LBC_ID  = 'ID_DU_ROLE_NOTIFICATIONS_LBC';
const ROLES_AUTORISES = [
  'ID_ROLE_EMPLOYE',
  'ID_ROLE_DIRECTION',
];
```

---

## 🛠️ Utilisation quotidienne

### Publier une annonce
```
/annonce numero:1337 type:Appartement Simple transaction:vente quartier:Rockford Hills image:[photo]
```
→ Publie le message formaté avec ping `@Notification-LBC` et les boutons Acheter / Visiter.

### Créer un récap LBC
```
/recaplbc annonce:1337 prix_depart:210'000$ commission:10% type:Garage 6 places adresse:Rockford Hills frais_dossier:true double_cles:true gps:[image] carte_identite:[image]
```

### Modifier un récap LBC
```
/editrecaplbc message_id:123456789012345678 prix_depart:220'000$ negociation:210'000$
```

### Renommer un ticket
```
/rename agent:@SachaRollay statut:vendu numero:1336 description:Sacha-Rollay
```
→ Renomme le salon en : `🦊✅𝟭𝟯𝟯𝟲_𝗦𝗮𝗰𝗵𝗮-𝗥𝗼𝗹𝗹𝗮𝘆`

### Planifier un rendez-vous
```
/rdv créer client:@Client date:aujourd'hui heure:18h30 description:Visite appartement rappel:30
```
→ Envoie une confirmation avec ping des deux parties, puis un rappel 30 min avant et à l'heure pile.

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes après le démarrage, les commandes prennent du temps à s'enregistrer.

**`@Notification-LBC` ne ping pas dans les annonces ?**
→ Vérifie que `ROLE_NOTIFICATIONS_LBC_ID` dans `commands/annonce.js` correspond bien à l'ID du rôle sur ton serveur.

**Les rappels de RDV ne se déclenchent pas à la bonne heure ?**
→ Vérifie que la variable `TZ=Europe/Paris` est bien configurée dans Railway.

**"Connecté à MongoDB" n'apparaît pas dans les logs ?**
→ Vérifie que `MONGODB_URI` est correctement renseigné avec le bon user/password et que l'IP `0.0.0.0/0` est autorisée dans Atlas.

**`@agent` non reconnu dans `/rename` ?**
→ Son ID Discord n'est pas encore dans la liste `AGENTS` de `commands/rename.js`.

**`/editrecaplbc` ne trouve pas le message ?**
→ Utilise la commande dans le même salon que le récap. Assure-toi que le mode développeur est activé pour copier l'ID du message.

---

*Dynasty 8 — Baylife RP | Bot créé avec ❤️*
