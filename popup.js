// SEO Social Optimizer AI - Popup Controller

const DEFAULT_SETTINGS = {
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "gemma4:31b-cloud",
  lmStudioUrl: "http://localhost:1234",
  lmStudioModel: "qwen2.5-coder-7b-instruct",
  systemPrompt: "You are an expert SEO copywriter and social media strategist. Rewrite the following user post to make it highly engaging, professional, and SEO-optimized for social media (Facebook, Instagram, LinkedIn, X). Maintain the original tone and core message, but enhance search visibility, improve structure, increase readability, and append 3-5 highly relevant, high-traffic hashtags. Return ONLY the optimized text, directly. Absolutely no introductions, no explanations, no chat preamble, and do not wrap the output in markdown code blocks or quotes. Just the raw, rewritten text."
};

document.addEventListener("DOMContentLoaded", () => {
  // Navigation elements
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Settings inputs
  const ollamaUrlInput = document.getElementById("ollama-url");
  const ollamaModelInput = document.getElementById("ollama-model");
  const lmStudioUrlInput = document.getElementById("lmstudio-url");
  const lmStudioModelInput = document.getElementById("lmstudio-model");
  const systemPromptInput = document.getElementById("system-prompt");
  
  // Status elements
  const ollamaIndicator = document.getElementById("ollama-indicator");
  const ollamaText = document.getElementById("ollama-text");
  const ollamaModelBadge = document.getElementById("ollama-model-badge");
  const ollamaCard = document.getElementById("ollama-status-card");

  const lmstudioIndicator = document.getElementById("lmstudio-indicator");
  const lmstudioText = document.getElementById("lmstudio-text");
  const lmstudioModelBadge = document.getElementById("lmstudio-model-badge");
  const lmstudioCard = document.getElementById("lmstudio-status-card");

  const windowaiIndicator = document.getElementById("windowai-indicator");
  const windowaiText = document.getElementById("windowai-text");
  const windowaiModelBadge = document.getElementById("windowai-model-badge");
  const windowaiCard = document.getElementById("windowai-status-card");

  // Actions
  const saveBtn = document.getElementById("save-settings-btn");
  const saveStatus = document.getElementById("save-status");
  const resetPromptBtn = document.getElementById("reset-prompt-btn");

  // Playground elements
  const runTestBtn = document.getElementById("run-test-btn");
  const playgroundInput = document.getElementById("playground-input");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnText = document.getElementById("btn-text");
  const resultContainer = document.getElementById("test-result-container");
  const resultProvider = document.getElementById("result-provider");
  const playgroundOutput = document.getElementById("playground-output");
  const copyResultBtn = document.getElementById("copy-result-btn");

  // 1. Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(`tab-${targetTab}`).classList.add("active");
    });
  });

  // 2. Load Settings
  function loadSettings() {
    chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (stored) => {
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      
      ollamaUrlInput.value = settings.ollamaUrl;
      ollamaModelInput.value = settings.ollamaModel;
      lmStudioUrlInput.value = settings.lmStudioUrl;
      lmStudioModelInput.value = settings.lmStudioModel;
      systemPromptInput.value = settings.systemPrompt;

      // Update model display badges in real-time
      ollamaModelBadge.textContent = settings.ollamaModel.split(":")[0];
      lmstudioModelBadge.textContent = settings.lmStudioModel.replace("-7b-instruct", "").replace("qwen2.5-", "");
      
      // Instantly trigger connection check after loading details
      checkConnectionStatus();
    });
  }

  // 3. Save Settings
  saveBtn.addEventListener("click", () => {
    const settings = {
      ollamaUrl: ollamaUrlInput.value.trim() || DEFAULT_SETTINGS.ollamaUrl,
      ollamaModel: ollamaModelInput.value.trim() || DEFAULT_SETTINGS.ollamaModel,
      lmStudioUrl: lmStudioUrlInput.value.trim() || DEFAULT_SETTINGS.lmStudioUrl,
      lmStudioModel: lmStudioModelInput.value.trim() || DEFAULT_SETTINGS.lmStudioModel,
      systemPrompt: systemPromptInput.value.trim() || DEFAULT_SETTINGS.systemPrompt
    };

    chrome.storage.local.set(settings, () => {
      // Re-update labels
      ollamaModelBadge.textContent = settings.ollamaModel.split(":")[0];
      lmstudioModelBadge.textContent = settings.lmStudioModel.replace("-7b-instruct", "").replace("qwen2.5-", "");

      // Display dynamic confirmation
      saveStatus.classList.add("visible");
      setTimeout(() => {
        saveStatus.classList.remove("visible");
      }, 2000);

      // Recheck connections in case URLs were modified
      checkConnectionStatus();
    });
  });

  // 4. Reset Prompt
  resetPromptBtn.addEventListener("click", () => {
    systemPromptInput.value = DEFAULT_SETTINGS.systemPrompt;
  });

  // 5. Connect Status Verification
  function checkConnectionStatus() {
    ollamaText.textContent = "Checking...";
    lmstudioText.textContent = "Checking...";
    windowaiText.textContent = "Checking...";

    // Send checkStatus to background
    chrome.runtime.sendMessage({ action: "checkStatus" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setOfflineState(ollamaIndicator, ollamaText, ollamaCard);
        setOfflineState(lmstudioIndicator, lmstudioText, lmstudioCard);
        setOfflineState(windowaiIndicator, windowaiText, windowaiCard);
        return;
      }

      // Ollama UI update
      if (response.ollamaOnline) {
        setOnlineState(ollamaIndicator, ollamaText, ollamaCard);
      } else {
        setOfflineState(ollamaIndicator, ollamaText, ollamaCard);
      }

      // LM Studio UI update
      if (response.lmStudioOnline) {
        setOnlineState(lmstudioIndicator, lmstudioText, lmstudioCard);
      } else {
        setOfflineState(lmstudioIndicator, lmstudioText, lmstudioCard);
      }

      // Window.ai UI update
      if (response.windowAiOnline) {
        setOnlineState(windowaiIndicator, windowaiText, windowaiCard);
        windowaiText.textContent = response.windowAiStatus || "Available";
        windowaiModelBadge.textContent = response.windowAiType === "languageModel" ? "Gemini Nano" : "Built-in AI";
      } else {
        setOfflineState(windowaiIndicator, windowaiText, windowaiCard);
        windowaiText.textContent = response.windowAiStatus || "Unavailable";
        if (response.windowAiStatus === "Not Downloaded") {
          windowaiModelBadge.textContent = "Needs D/L";
        } else {
          windowaiModelBadge.textContent = "Unsupported";
        }
      }
    });
  }

  function setOnlineState(indicator, textElement, cardElement) {
    indicator.className = "status-indicator online";
    textElement.textContent = "Online";
    textElement.style.color = "var(--color-online)";
    cardElement.classList.add("active-card");
  }

  function setOfflineState(indicator, textElement, cardElement) {
    indicator.className = "status-indicator offline";
    textElement.textContent = "Offline";
    textElement.style.color = "var(--text-muted)";
    cardElement.classList.remove("active-card");
  }

  // 6. Test Playground Integration
  runTestBtn.addEventListener("click", () => {
    const text = playgroundInput.value.trim();
    if (!text) return;

    // Loading State
    runTestBtn.disabled = true;
    btnSpinner.classList.remove("hidden");
    btnText.textContent = "Optimizing...";
    resultContainer.classList.add("hidden");

    chrome.runtime.sendMessage({ action: "optimize", text: text }, (response) => {
      runTestBtn.disabled = false;
      btnSpinner.classList.add("hidden");
      btnText.textContent = "Optimize Post";

      if (chrome.runtime.lastError) {
        showPlaygroundError("Internal service worker connection timeout.");
        return;
      }

      if (response && response.success) {
        showPlaygroundResult(response.optimizedText, response.provider);
      } else {
        showPlaygroundError(response ? response.error : "Unknown connection failure.");
      }
    });
  });

  function showPlaygroundResult(text, provider) {
    resultContainer.classList.remove("hidden");
    resultProvider.textContent = provider;
    resultProvider.style.color = "var(--color-online)";
    playgroundOutput.textContent = text;
    playgroundOutput.style.borderColor = "rgba(16, 185, 129, 0.25)";
    playgroundOutput.style.color = "#a7f3d0";
  }

  function showPlaygroundError(errorMsg) {
    resultContainer.classList.remove("hidden");
    resultProvider.textContent = "Error";
    resultProvider.style.color = "var(--color-offline)";
    playgroundOutput.textContent = errorMsg;
    playgroundOutput.style.borderColor = "rgba(239, 68, 68, 0.25)";
    playgroundOutput.style.color = "#fca5a5";
  }

  // 7. Clipboard copy
  copyResultBtn.addEventListener("click", () => {
    const text = playgroundOutput.textContent;
    if (!text || resultProvider.textContent === "Error") return;

    navigator.clipboard.writeText(text).then(() => {
      const originalText = copyResultBtn.textContent;
      copyResultBtn.textContent = "Copied!";
      copyResultBtn.style.background = "var(--accent-gradient)";
      
      setTimeout(() => {
        copyResultBtn.textContent = originalText;
        copyResultBtn.style.background = "rgba(255, 255, 255, 0.05)";
      }, 1500);
    });
  });

  // Initialization
  loadSettings();
  
  // Poll connection states every 10 seconds while popup remains open
  const pollInterval = setInterval(checkConnectionStatus, 10000);
  window.addEventListener("unload", () => clearInterval(pollInterval));
});
