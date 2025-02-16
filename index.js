// index.js
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import dotenv from "dotenv";

dotenv.config();

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const AZURE_ENDPOINT = process.env.AZURE_INFERENCE_SDK_ENDPOINT;
const AZURE_KEY = process.env.AZURE_INFERENCE_SDK_KEY;
const DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME || "DeepSeek-R1";

// Initialize the Azure ModelClient
const azureClient = new ModelClient(
  AZURE_ENDPOINT,
  new AzureKeyCredential(AZURE_KEY)
);

// Initialize the Discord client with the necessary intents
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.once("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}`);
});

const systemMessage = {
  role: "system",
  content:
    "You are a helpful assistant. Always use your reasoning capability which provides the reasoning content in <think> tags to respond to the user.",
};
const chatHistory = {};

// Listen for messages on Discord
discordClient.on("messageCreate", async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the message starts with the command prefix (e.g., "!chat")
  // New user
  const username = message.author.username;
  if (!chatHistory[username]) {
    chatHistory[username] = [systemMessage];
  }

  // Extract the user's prompt
  const userPrompt = message.content.trim();

  if (!userPrompt) {
    message.channel.send("Please provide a prompt after the command.");
    return;
  }

  // Start the typing indicator by setting an interval
  message.channel.sendTyping().catch(console.error);
  const typingInterval = setInterval(() => {
    message.channel.sendTyping().catch(console.error);
  }, 4000); // Adjust interval as needed (e.g., every 4 seconds)

  // Construct the messages array for the chat request
  chatHistory[username].push({ role: "user", content: userPrompt });

  console.log(`user ${username}: `, userPrompt);
  console.log("chat history length: ", chatHistory[username].length);

  try {
    // Call the Azure LLM API using the Azure SDK
    const response = await azureClient.path("chat/completions").post({
      body: {
        messages: chatHistory[username],
        max_tokens: 4000,
        model: DEPLOYMENT_NAME,
      },
    });

    // Stop typing indicator before sending the reply
    clearInterval(typingInterval);

    // Log the response
    console.log(JSON.stringify(response, null, 2));

    // Add the assistant's response to the chat history
    chatHistory[username].push(response.body.choices[0].message);

    // Send the response as a message to discord
    const llmReply = JSON.stringify(response.body.choices[0].message.content);
    const embeds = createDiscordMessages(llmReply);
    for (const embed of embeds) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    clearInterval(typingInterval);
    console.error("Error communicating with the LLM API:", error);
    message.channel.send("There was an error contacting the LLM API.");
  }
});

// Log in to Discord with your bot token
discordClient.login(DISCORD_TOKEN);

const createDiscordMessages = (message) => {
  const toDiscordMessages = (content, think = false) =>
    content === ""
      ? []
      : content
          .match(/.{1,2000}/g)
          .map((thunk) =>
            new EmbedBuilder()
              .setTitle(think ? "Think" : "Reply")
              .setDescription(`${thunk.replace(/\\n/g, "\n")}`)
          );

  message = message.substring(1, message.length - 1);
  const thinkRegex = /<think>(.*?)<\/think>/s;
  const thinkMatch = message.match(thinkRegex);
  const think = thinkMatch ? thinkMatch[1] : "";
  const content = thinkMatch
    ? message.slice(thinkMatch.index + thinkMatch[0].length)
    : message;
  return [...toDiscordMessages(think, true), ...toDiscordMessages(content)];
};
