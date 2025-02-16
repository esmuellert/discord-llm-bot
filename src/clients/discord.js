import { Client, GatewayIntentBits, Partials } from 'discord.js';

export const createDiscordClient = () => {
  return new Client({
    intents: [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });
};
