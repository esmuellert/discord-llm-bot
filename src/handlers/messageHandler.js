import { EmbedBuilder } from 'discord.js';
import { azureClient } from '../clients/azure.js';
import { DEPLOYMENT_NAME, SYSTEM_MESSAGE } from '../config/constants.js';
import { processStream } from '../utils/streamProcessor.js';
import { createSseStream } from '@azure/core-sse';

const chatHistory = {};
let typingInterval;

export const handleDefaultMessage = async (message) => {
  if (message.author.bot) return;

  const username = message.author.username;
  if (!chatHistory[username]) {
    chatHistory[username] = [SYSTEM_MESSAGE];
  }

  const userPrompt = message.content.trim();
  if (!userPrompt) {
    message.channel.send('Please provide a prompt after the command.');
    return;
  }

  message.channel.sendTyping().catch(console.error);
  typingInterval = setInterval(() => {
    message.channel.sendTyping().catch(console.error);
  }, 4000);

  chatHistory[username].push({ role: 'user', content: userPrompt });
  logUserMessage(username, userPrompt, chatHistory[username].length);

  try {
    const response = await azureClient
      // @ts-ignore
      .path('chat/completions')
      .post({
        body: {
          messages: chatHistory[username],
          model: DEPLOYMENT_NAME,
          stream: true
        }
      })
      .asNodeStream();

    const stream = response.body;
    // @ts-ignore
    const sses = createSseStream(stream);
    const content = await processStream(sses, message, typingInterval);
    chatHistory[username].push({ role: 'assistant', content });
  } catch (error) {
    clearInterval(typingInterval);
    console.error('Error communicating with the LLM API:', error);
    message.channel.send('There was an error contacting the LLM API.');
  }
};

export const handleInteraction = async (interaction) => {
  if (!interaction.isCommand()) return;

  const username = interaction.user.username;

  switch (interaction.commandName) {
    case 'clear':
      chatHistory[username] = [SYSTEM_MESSAGE];
      await interaction.reply({ content: 'Chat history cleared.' });
      console.log(`Chat history cleared for ${username}`);
      break;

    case 'history':
      await handleHistoryCommand(interaction, username);
      break;

    case 'delete_direct_message':
      await handleDeleteDirectMessage(interaction, username);
      break;
  }
};

const handleHistoryCommand = async (interaction, username) => {
  const history = chatHistory?.[username]
    ?.filter((msg) => msg.role === 'user')
    ?.map((msg) => msg.content)
    .join('\n');

  const embeds = new EmbedBuilder()
    .setTitle('Chat History (User Question Only)')
    .setDescription(history?.length > 0 ? history : '## No chat history found.');

  await interaction.reply({ embeds: [embeds] });
  console.log(`Chat history sent for ${username}`);
};

const handleDeleteDirectMessage = async (interaction, username) => {
  try {
    const dmChannel = await interaction.user.createDM();
    const messages = await dmChannel.messages.fetch({ limit: 100 });
    const botMessage = messages.find((msg) => msg.author.id === interaction.client.user.id);

    if (botMessage) {
      await botMessage.delete();
      await interaction.reply({
        content: 'Previous DM deleted.',
        ephemeral: true
      });
      console.log(`Previous DM deleted for ${username}`);
    } else {
      await interaction.reply({
        content: 'No previous DM found.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Failed to delete the previous DM:', error);
    await interaction.reply({
      content: 'Failed to delete message.',
      ephemeral: true
    });
  }
};

const logUserMessage = (username, prompt, historyLength) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`user ${username}: ${prompt}\nchat history length: ${historyLength}`);
  } else {
    console.log(`user ${username}: [hidden]\nchat history length: ${historyLength}`);
  }
};
