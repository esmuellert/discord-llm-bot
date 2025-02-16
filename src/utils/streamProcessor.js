export const processStream = async (sses, message, typingInterval) => {
  let isThinking = false;
  let think = "";
  let responseMessage = "";
  let lastMessage;
  let completeMessage = "";
  let thinkingStart;

  const isInsideCodeBlock = (text) => {
    const matches = text.match(/```/g);
    return matches ? matches.length % 2 === 1 : false;
  };

  const findLastCompleteBlock = (text) => {
    if (!isInsideCodeBlock(text)) return text.length;
    
    let lastComplete = text.lastIndexOf('```');
    while (lastComplete > 0 && isInsideCodeBlock(text.substring(0, lastComplete))) {
      lastComplete = text.lastIndexOf('```', lastComplete - 1);
    }
    return lastComplete > 0 ? lastComplete : 0;
  };

  const handleMessageSplit = async (currentText, newContent, lastMsg) => {
    if (isInsideCodeBlock(currentText + newContent)) {
      const splitPoint = findLastCompleteBlock(currentText);
      const nextMessage = currentText.substring(splitPoint) + newContent;
      const updatedCurrentText = currentText.substring(0, splitPoint);
      
      await lastMsg.edit(updatedCurrentText);
      const newLastMsg = await message.channel.send(nextMessage);
      return { text: nextMessage, lastMessage: newLastMsg };
    } else {
      await lastMsg.edit(currentText);
      const newLastMsg = await message.channel.send(newContent);
      return { text: newContent, lastMessage: newLastMsg };
    }
  };

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
        const thinkingTime = new Date().getTime() - thinkingStart.getTime();
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
          const result = await handleMessageSplit(think, content, lastMessage);
          think = result.text;
          lastMessage = result.lastMessage;
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
        const result = await handleMessageSplit(responseMessage, content, lastMessage);
        responseMessage = result.text;
        lastMessage = result.lastMessage;
      }
    }
  }
};

const shouldUpdateMessage = (message) =>
  message.length % 100 > 0 && message.length % 100 < 5;
