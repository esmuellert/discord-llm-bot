import dotenv from "dotenv";

dotenv.config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const AZURE_ENDPOINT = process.env.AZURE_INFERENCE_SDK_ENDPOINT;
export const AZURE_KEY = process.env.AZURE_INFERENCE_SDK_KEY;
export const DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME || "DeepSeek-R1";
export const PORT = process.env.PORT || 3000;

export const SYSTEM_MESSAGE = {
  role: "system",
  content: `You are a helpful assistant. 
  RULE:
  You must use your reasoning capability to provide answer to users. Your reasoning content is included between <think> and </think>.
  You should avoid using markdown table syntax in your response because user's client can't render markdown table. You should use alternative syntax to express the same information.`,
};
