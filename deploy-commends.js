import { SlashCommandBuilder, Routes, REST } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName("history")
    .setDescription(
      "Show current user questions in LLM's chat history context"
    ),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription(
      "Clear LLM's chat history context (still remains in Discord's message history)"
    ),
  new SlashCommandBuilder()
    .setName("delete_direct_message")
    .setDescription("Delete the previous LLM's response in DM with you"),
].map((command) => command.toJSON());

const check = process.argv.includes("--check");
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

if (check) {
  rest
    .get(Routes.applicationCommands(process.env.CLIENT_ID))
    .then((data) => console.log(data))
    .catch(console.error);
} else {
  rest
    .put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
    .then(() => console.log("Commands registered!"))
    .catch(console.error);
}

