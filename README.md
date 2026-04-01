# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière | Baylife RP

---

## 📋 Commandes disponibles

| Commande | Description | Permission |
|---|---|---|
| `/rdv créer` | Planifier un rendez-vous avec un client (rappels automatiques) | Agentes |
| `/rdv liste` | Voir tous les rendez-vous à venir | Agentes |
| `/rdv annuler` | Annuler un rendez-vous planifié | Agentes |
| `/client dossier` | Voir le dossier complet d'un client | Agentes |
| `/client statut` | Mettre à jour le statut d'un dossier | Agentes |
| `/client liste` | Voir tous les dossiers actifs | Agentes |
| `/rename` | Renommer un ticket avec agent, statut, numéro et nom client | Admins |

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
TOKEN         = (token de ton bot Discord)
CLIENT_ID     = (Application ID depuis le Developer Portal)
GUILD_ID      = (ID de ton serveur Discord)
CHANNEL_LOGS_ID = (ID du canal logs agents — optionnel)
MONGODB_URI   = (URI MongoDB Atlas avec user:password remplis)
TZ            = Europe/Paris
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

## 🛠️ Utilisation quotidienne

### Planifier un rendez-vous
```
/rdv créer client:@Client date:aujourd'hui heure:18h30 description:Visite appartement rappel:30
```
→ Envoie une confirmation avec ping des deux parties, puis un rappel 30 min avant et à l'heure pile.

### Gérer un rendez-vous
```
/rdv liste
/rdv annuler id:rdv_1234567890
```

### Voir le dossier d'un client
```
/client dossier membre:@Client
```

### Mettre à jour un statut de dossier
```
/client statut membre:@Client reference:ID_DOSSIER statut:Conclu note:Bien vendu !
```

### Renommer un ticket
```
/rename agent:@SachaRollay statut:vendu numero:1336 prenom:Norah nom:Kartelle
```
→ Renomme le salon en : `🦊✅𝟭𝟯𝟯𝟲_𝗡𝗼𝗿𝗮𝗵-𝗞𝗮𝗿𝘁𝗲𝗹𝗹𝗲`

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes après le démarrage, les commandes prennent du temps à s'enregistrer.

**Les rappels de RDV ne se déclenchent pas à la bonne heure ?**
→ Vérifie que la variable `TZ=Europe/Paris` est bien configurée dans Railway.

**"Connecté à MongoDB" n'apparaît pas dans les logs ?**
→ Vérifie que `MONGODB_URI` est correctement renseigné avec le bon user/password et que l'IP `0.0.0.0/0` est autorisée dans Atlas.

**`@agent` non reconnu dans `/rename` ?**
→ Son ID Discord n'est pas encore dans la liste `AGENTS` de `commands/rename.js`.

---

*Dynasty 8 — Baylife RP | Bot créé avec ❤️*
