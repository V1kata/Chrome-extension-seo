// SEO Social Optimizer AI - Content Bridge Script
// Runs in the ISOLATED world (default) on <all_urls>
// Bridges the background script (chrome.runtime) and content_script.js (MAIN world window.ai)

const pendingRequests = new Map();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkWindowAi" || message.action === "windowAiOptimize") {
    // Generate a unique Request ID safe in both HTTP and HTTPS contexts
    const requestId = 'seo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    
    // Store response callback
    pendingRequests.set(requestId, sendResponse);

    // Forward the message to the MAIN world
    window.postMessage({
      source: "seo-optimizer-bridge",
      requestId,
      action: message.action,
      payload: message
    }, "*");

    // Keep the message channel open for async response
    return true;
  }
});

// Listen for responses back from the MAIN world (content_script.js)
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "seo-optimizer-page") {
    return;
  }

  const { requestId, payload } = event.data;
  const sendResponse = pendingRequests.get(requestId);

  if (sendResponse) {
    sendResponse(payload);
    pendingRequests.delete(requestId);
  }
});
