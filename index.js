// index.js
import { Client, GatewayIntentBits, EmbedBuilder, Partials } from "discord.js";
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import dotenv from "dotenv";
import { createSseStream } from "@azure/core-sse";
import http from "http";

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
    GatewayIntentBits.DirectMessages, // Required for DMs
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

discordClient.once("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}`);
});

const systemMessage = {
  role: "system",
  content: `You are a helpful assistant. You must use your reasoning capability to provide answer to users. Your reasoning content is included between <think> and </think>.`,
};
const chatHistory = {};
let typingInterval;
let thinkingStart;

// Listen for messages on Discord
discordClient.on("messageCreate", async (message) => {
  try {
    await defaultMessageHandler(message);
  } catch (error) {
    console.error("Error processing message:", error);
    message.channel.send("There was an error processing your message.");
  }
});

// Log in to Discord with your bot token
discordClient.login(DISCORD_TOKEN);

http
  .createServer((req, res) => {
    res.end("Bot is running");
  })
  .listen(process.env.PORT || 3000);

const defaultMessageHandler = async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  const username = message.author.username;

  // Clear chat history
  if (message.content.startsWith("/clear")) {
    chatHistory[username] = [systemMessage];
    message.channel.send("Chat history cleared.");
    return;
  }

  if (message.content.trim() === "/history") {
    const history = chatHistory?.[username]
      ?.filter((msg) => msg.role === "user")
      ?.map((msg) => msg.content)
      .join("\n");
    const embeds = new EmbedBuilder()
      .setTitle("Chat History (User Question Only)")
      .setDescription(
        history?.length > 0 ? history : "## No chat history found."
      );
    await message.channel.send({ embeds: [embeds] });
    return;
  }

  if (message.content.trim() === "/deleteDM") {
    try {
      // Open a DM channel with the user
      const dmChannel = await message.author.createDM();

      // Fetch the most recent messages from the DM channel
      const messages = await dmChannel.messages.fetch({ limit: 100 });

      // Find the specific message sent by the bot
      const botMessage = messages.find(
        (msg) => msg.author.id === discordClient.user.id
      );

      if (botMessage) {
        // Delete the bot's message
        await botMessage.delete();
        if (process.env.NODE_ENV === "development") {
          console.log("Previous DM deleted successfully!");
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("No previous DM found.");
        }
      }
    } catch (error) {
      console.error("Failed to delete the previous DM:", error);
    }
    return;
  }

  // New user
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
  typingInterval = setInterval(() => {
    message.channel.sendTyping().catch(console.error);
  }, 4000); // Adjust interval as needed (e.g., every 4 seconds)

  // Construct the messages array for the chat request
  chatHistory[username].push({ role: "user", content: userPrompt });

  console.log(`user ${username}: `, userPrompt);
  console.log("chat history length: ", chatHistory[username].length);

  try {
    // Call the Azure LLM API using the Azure SDK
    const response = await azureClient
      .path("chat/completions")
      .post({
        body: {
          messages: chatHistory[username],
          model: DEPLOYMENT_NAME,
          stream: true,
        },
      })
      .asNodeStream();
    const stream = response.body;
    const sses = createSseStream(stream);
    const content = await processStream(sses, message);
    chatHistory[username].push({ role: "assistant", content });
  } catch (error) {
    clearInterval(typingInterval);
    console.error("Error communicating with the LLM API:", error);
    message.channel.send("There was an error contacting the LLM API.");
  }
};

const processStream = async (sses, message) => {
  let isThinking = false;
  let think = "";
  let responseMessage = "";
  let lastMessage;
  let completeMessage = "";
  for await (const event of sses) {
    if (event.data === "[DONE]") {
      lastMessage.edit(responseMessage);
      clearInterval(typingInterval);
      return completeMessage;
    }
    for (const choice of JSON.parse(event.data).choices) {
      const content = choice.delta?.content ?? "";
      completeMessage += content;

      if (content === "<think>") {
        thinkingStart = new Date();
        isThinking = true;
        think = "## Thinking...\n";
        lastMessage = await message.channel.send(think);
      } else if (content === "</think>") {
        isThinking = false;
        const thinkingTime = new Date() - thinkingStart;
        responseMessage = "## Response:\n";
        think &&
          lastMessage.edit(
            think.replace(
              "## Thinking...",
              `## Thinking for ${thinkingTime / 1000}s`
            )
          );
        lastMessage = await message.channel.send(responseMessage);
      } else if (content) {
        if (process.env.NODE_ENV === "development") {
          process.stdout.write(content);
        }
        if (isThinking) {
          if ((think + content).length < 2000) {
            think += content;
            if (shouldUpdateMessage(think)) {
              await lastMessage.edit(think);
            }
          } else {
            think && lastMessage.edit(think);
            think = content;
            lastMessage = await message.channel.send(think);
          }
        } else {
          if ((responseMessage + content).length < 2000) {
            responseMessage += content;
            if (shouldUpdateMessage(responseMessage)) {
              if (lastMessage) {
                await lastMessage.edit(responseMessage);
              } else {
                responseMessage = "## Response:\n" + responseMessage;
                lastMessage = await message.channel.send(responseMessage);
              }
            }
          } else {
            responseMessage && lastMessage.edit(responseMessage);
            responseMessage = content;
            lastMessage = await message.channel.send(responseMessage);
          }
        }
      }
    }
  }
};

const throwEmptyError = (content) => {
  if (!content) {
    throw new Error("Response is empty");
  }
};

const shouldUpdateMessage = (message) =>
  message.length % 300 > 0 && message.length % 300 < 20;
