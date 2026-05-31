// SEO Social Optimizer AI - Window.ai Proxy Content Script
// This script runs on <all_urls> to execute on-device Gemini Nano inference.
// It bypasses Service Worker restrictions by executing in the webpage window context.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkWindowAi") {
    (async () => {
      try {
        const globalAI = typeof ai !== "undefined" ? ai : null;
        if (globalAI?.languageModel) {
          const caps = await globalAI.languageModel.capabilities();
          const available = caps?.available !== "no";
          sendResponse({
            available,
            status: available ? "Available" : "Not Downloaded",
            type: "languageModel",
          });
        } else if (globalAI?.assistant) {
          sendResponse({
            available: true,
            status: "Available",
            type: "assistant",
          });
        } else {
          sendResponse({
            available: false,
            status: "Unsupported",
            type: "none",
          });
        }
      } catch (e) {
        sendResponse({ available: false, status: "Error", type: "error" });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.action === "windowAiOptimize") {
    (async () => {
      try {
        const globalAI = typeof ai !== "undefined" ? ai : null;
        if (!globalAI) throw new Error("On-device AI (Gemini Nano) not found in this browser.");

        let session;
        if (globalAI.languageModel) {
          session = await globalAI.languageModel.create({
            systemPrompt: message.systemPrompt,
          });
        } else if (globalAI.assistant) {
          session = await globalAI.assistant.create({
            systemPrompt: message.systemPrompt,
          });
        } else {
          throw new Error("No supported AI capabilities interface detected.");
        }

        const result = await session.prompt(message.text);
        session.destroy();
        sendResponse({ success: true, result: result.trim() });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});