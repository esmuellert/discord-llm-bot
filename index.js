// index.js
import http from "http";
import { createDiscordClient } from "./src/clients/discord.js";
import { handleDefaultMessage, handleInteraction } from "./src/handlers/messageHandler.js";
import { DISCORD_TOKEN, PORT } from "./src/config/constants.js";

const discordClient = createDiscordClient();

discordClient.once("ready", () => {
  console.log(`Logged in as ${discordClient.user.tag}`);
});

discordClient.on("messageCreate", async (message) => {
  try {
    if (
      message.content.startsWith("/history") ||
      message.content.startsWith("/clear") ||
      message.content.startsWith("/delete_direct_message")
    ) {
      return;
    }
    await handleDefaultMessage(message);
  } catch (error) {
    console.error("Error processing message:", error);
    message.channel.send("There was an error processing your message.");
  }
});

discordClient.on("interactionCreate", handleInteraction);

discordClient.login(DISCORD_TOKEN);

http
  .createServer((req, res) => {
    res.end("Bot is running");
  })
  .listen(PORT);
