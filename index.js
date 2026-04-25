require('dotenv').config();

// Force Node.js à utiliser Google DNS (fix ECONNREFUSED sur Windows pour mongodb+srv://)
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { connectDB, getDB } = require('./utils/db');
const agentCache = require('./utils/agentCache');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();

(async () => {
  await connectDB();
  await agentCache.init(getDB());   // ← charge les agents avant les commandes
  await loadCommands(client);
  await loadEvents(client);
  await client.login(process.env.TOKEN);
})();
