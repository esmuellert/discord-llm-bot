export const processStream = async (sses, message, typingInterval) => {
  let isThinking = false;
  let think = "";
  let responseMessage = "";
  let lastMessage;
  let completeMessage = "";
  let thinkingStart;

  for await (const event of sses) {
    if (event.data === "[DONE]") {
      await lastMessage.edit(responseMessage);
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
        continue;
      }

      if (content === "</think>") {
        isThinking = false;
        const thinkingTime = new Date() - thinkingStart;
        responseMessage = "## Response:\n";
        if (think) {
          await lastMessage.edit(
            think.replace("## Thinking...", `## Thinking for ${thinkingTime / 1000}s`)
          );
        }
        lastMessage = await message.channel.send(responseMessage);
        continue;
      }

      if (!content) continue;

      if (process.env.NODE_ENV === "development") {
        process.stdout.write(content);
      }

      // Handle thinking state updates
      if (isThinking) {
        if ((think + content).length < 2000) {
          think += content;
          if (shouldUpdateMessage(think)) {
            await lastMessage.edit(think);
          }
        } else {
          await lastMessage.edit(think);
          think = content;
          lastMessage = await message.channel.send(content);
        }
        continue;
      }

      // Handle response state updates
      if ((responseMessage + content).length < 2000) {
        responseMessage += content;
        if (shouldUpdateMessage(responseMessage)) {
          if (lastMessage) {
            await lastMessage.edit(responseMessage);
          } else {
            lastMessage = await message.channel.send("## Response:\n" + responseMessage);
          }
        }
      } else {
        await lastMessage.edit(responseMessage);
        responseMessage = content;
        lastMessage = await message.channel.send(content);
      }
    }
  }
};

const shouldUpdateMessage = (message) =>
  message.length % 100 > 0 && message.length % 100 < 5;
