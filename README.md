# Discord LLM Bot

A Discord bot that integrates with Azure AI Services to provide LLM-powered chat capabilities in Discord channels.

## Features

- Chat with LLM through Discord channels
- Streaming response with thinking process
- Chat history management
- Support for code blocks and long messages
- Direct message support

## Prerequisites

- Node.js >= 18.0.0
- Discord Bot Token
- Azure AI Services account
- Azure AI Foundry model deployment

## Setup

1. Clone the repository:

```bash
git clone https://github.com/esmuellert/discord-llm-bot.git
cd discord-llm-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
DISCORD_TOKEN=your_discord_bot_token
AZURE_INFERENCE_SDK_ENDPOINT=your_azure_endpoint
AZURE_INFERENCE_SDK_KEY=your_azure_key
DEPLOYMENT_NAME=DeepSeek-R1
CLIENT_ID=your_discord_client_id
```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Add a bot to your application
4. Enable Message Content Intent in the Bot settings
5. Copy the bot token to your `.env` file
6. Use the OAuth2 URL Generator to create an invite link for your bot
7. Invite the bot to your server

### Azure AI Service Setup

1. Create an Azure AI Services resource
2. Deploy your model (default: DeepSeek-R1)
3. Copy the endpoint and key to your `.env` file

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Deploy Commands

```bash
npm run deploy-commands
```

## Available Commands

- `/history` - Show chat history for current user
- `/clear` - Clear chat history
- `/delete_direct_message` - Delete previous bot response in DM

## Deployment

The bot can be deployed using:

- Docker
- Azure App Service
- AWS EC2/ECS
- Any Node.js hosting platform

## Model Configuration

By default, this bot uses the DeepSeek-R1 model from Azure AI Foundry. You can use any other model by:

1. Deploying a different model in your Azure AI Services
2. Updating the `DEPLOYMENT_NAME` in your `.env` file
3. Optionally adjusting the system message in `src/config/constants.js` to match your model's capabilities

## License

MIT
