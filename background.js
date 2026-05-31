// SEO Social Optimizer AI - Service Worker
// Handles proxy requests to local Ollama and LM Studio instances to avoid CORS issues.

const DEFAULT_SETTINGS = {
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "gemma4:31b-cloud",
  lmStudioUrl: "http://localhost:1234",
  lmStudioModel: "qwen2.5-coder-7b-instruct",
  systemPrompt:
    "You are an expert SEO copywriter and social media strategist. Rewrite the following user post to make it highly engaging, professional, and SEO-optimized for social media (Facebook, Instagram, LinkedIn, X). Maintain the original tone and core message, but enhance search visibility, improve structure, increase readability, and append 3-5 highly relevant, high-traffic hashtags. Return ONLY the optimized text, directly. Absolutely no introductions, no explanations, no chat preamble, and do not wrap the output in markdown code blocks or quotes. Just the raw, rewritten text.",
};

// Check if a service is online
async function checkService(url, endpoint) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000); // 2-second timeout for status ping

    const response = await fetch(`${url}${endpoint}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(id);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Call Ollama
async function callOllama(settings, text) {
  const url = `${settings.ollamaUrl}/api/chat`;
  const body = {
    model: settings.ollamaModel,
    messages: [
      { role: "system", content: settings.systemPrompt },
      { role: "user", content: text },
    ],
    stream: false,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned status ${response.status}`);
  }

  const data = await response.json();
  if (data.message && data.message.content) {
    return data.message.content.trim();
  }
  throw new Error("Invalid response format from Ollama");
}

// Call LM Studio
async function callLmStudio(settings, text) {
  const url = `${settings.lmStudioUrl}/v1/chat/completions`;
  const body = {
    model: settings.lmStudioModel,
    messages: [
      { role: "system", content: settings.systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.7,
    stream: false,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LM Studio returned status ${response.status}`);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  throw new Error("Invalid response format from LM Studio");
}

async function callWindowAIViaTab(settings, text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (
    !tab?.id ||
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:")
  ) {
    throw new Error("Window.ai not available on this page");
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tab.id,
      {
        action: "windowAiOptimize",
        systemPrompt: settings.systemPrompt,
        text: text,
      },
      (response) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        if (response?.success) return resolve(response.result);
        reject(new Error(response?.error || "Window.ai failed"));
      },
    );
  });
}

// Get combined settings (from storage or defaults)
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (stored) => {
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

// Listen for messages from Content script or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkStatus") {
    (async () => {
      const settings = await getSettings();
      const ollamaPromise = checkService(settings.ollamaUrl, "/");
      const lmStudioPromise = checkService(settings.lmStudioUrl, "/v1/models");

      // Window.ai се проверява през content script
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      let windowAiCap = {
        available: false,
        status: "Unsupported",
        type: "none",
      };

      if (
        tab?.id &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:")
      ) {
        windowAiCap = await new Promise((resolve) => {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "checkWindowAi" },
            (res) => {
              if (chrome.runtime.lastError)
                resolve({
                  available: false,
                  status: "Unsupported",
                  type: "none",
                });
              else
                resolve(
                  res || {
                    available: false,
                    status: "Unsupported",
                    type: "none",
                  },
                );
            },
          );
        });
      }

      const [ollamaOnline, lmStudioOnline] = await Promise.all([
        ollamaPromise,
        lmStudioPromise,
      ]);

      sendResponse({
        ollamaOnline,
        lmStudioOnline,
        windowAiOnline: windowAiCap.available,
        windowAiStatus: windowAiCap.status,
        windowAiType: windowAiCap.type,
      });
    })();
    return true;
  }

  if (message.action === "optimize") {
    (async () => {
      const settings = await getSettings();
      const textToOptimize = message.text;

      console.log(
        `[SEO Optimizer] Attempting optimization of text: "${textToOptimize.substring(0, 50)}..."`,
      );

      // 1. Try Ollama
      try {
        console.log(
          `[SEO Optimizer] Attempting Ollama (${settings.ollamaModel}) at ${settings.ollamaUrl}...`,
        );
        const result = await callOllama(settings, textToOptimize);
        console.log("[SEO Optimizer] Ollama optimization successful!");
        sendResponse({
          success: true,
          optimizedText: result,
          provider: "Ollama",
        });
        return;
      } catch (ollamaError) {
        console.warn("[SEO Optimizer] Ollama failed:", ollamaError.message);

        // 2. Fallback to LM Studio
        try {
          console.log(
            `[SEO Optimizer] Falling back to LM Studio (${settings.lmStudioModel}) at ${settings.lmStudioUrl}...`,
          );
          const result = await callLmStudio(settings, textToOptimize);
          console.log("[SEO Optimizer] LM Studio optimization successful!");
          sendResponse({
            success: true,
            optimizedText: result,
            provider: "LM Studio",
          });
          return;
        } catch (lmStudioError) {
          console.warn(
            "[SEO Optimizer] LM Studio failed:",
            lmStudioError.message,
          );

          // 3. Fallback to Window.ai
          try {
            console.log("[SEO Optimizer] Falling back to Window.ai...");
            const result = await callWindowAIViaTab(settings, textToOptimize);
            console.log("[SEO Optimizer] Window.ai optimization successful!");
            sendResponse({
              success: true,
              optimizedText: result,
              provider: "Window.ai",
            });
            return;
          } catch (windowAiError) {
            console.error(
              "[SEO Optimizer] Window.ai failed:",
              windowAiError.message,
            );
            sendResponse({
              success: false,
              error: `All providers failed. Ollama: ${ollamaError.message}. LM Studio: ${lmStudioError.message}. Window.ai: ${windowAiError.message}.`,
            });
          }
        }
      }
    })();
    return true; // Keep channel open for async response
  }
});
