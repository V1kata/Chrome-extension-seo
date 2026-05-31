// SEO Social Optimizer AI - Window.ai Proxy Content Script
// This script runs on <all_urls> to execute on-device Gemini Nano inference.
// It bypasses Service Worker restrictions by executing in the webpage window context.
// It communicates with content_bridge.js using window.postMessage.

window.addEventListener("message", async (event) => {
  // Only accept messages from our bridge script
  if (event.source !== window || !event.data || event.data.source !== "seo-optimizer-bridge") {
    return;
  }

  const { requestId, action, payload } = event.data;

  if (action === "checkWindowAi") {
    try {
      const globalAI = typeof ai !== "undefined" ? ai : null;
      if (globalAI?.languageModel) {
        const caps = await globalAI.languageModel.capabilities();
        const available = caps?.available !== "no";
        window.postMessage({
          source: "seo-optimizer-page",
          requestId,
          payload: {
            available,
            status: available ? "Available" : "Not Downloaded",
            type: "languageModel",
          }
        }, "*");
      } else if (globalAI?.assistant) {
        window.postMessage({
          source: "seo-optimizer-page",
          requestId,
          payload: {
            available: true,
            status: "Available",
            type: "assistant",
          }
        }, "*");
      } else {
        window.postMessage({
          source: "seo-optimizer-page",
          requestId,
          payload: {
            available: false,
            status: "Unsupported",
            type: "none",
          }
        }, "*");
      }
    } catch (e) {
      window.postMessage({
        source: "seo-optimizer-page",
        requestId,
        payload: { available: false, status: "Error", type: "error" }
      }, "*");
    }
  }

  if (action === "windowAiOptimize") {
    try {
      const globalAI = typeof ai !== "undefined" ? ai : null;
      if (!globalAI) throw new Error("On-device AI (Gemini Nano) not found in this browser.");

      let session;
      if (globalAI.languageModel) {
        session = await globalAI.languageModel.create({
          systemPrompt: payload.systemPrompt,
        });
      } else if (globalAI.assistant) {
        session = await globalAI.assistant.create({
          systemPrompt: payload.systemPrompt,
        });
      } else {
        throw new Error("No supported AI capabilities interface detected.");
      }

      const result = await session.prompt(payload.text);
      session.destroy();
      window.postMessage({
        source: "seo-optimizer-page",
        requestId,
        payload: { success: true, result: result.trim() }
      }, "*");
    } catch (e) {
      window.postMessage({
        source: "seo-optimizer-page",
        requestId,
        payload: { success: false, error: e.message }
      }, "*");
    }
  }
});