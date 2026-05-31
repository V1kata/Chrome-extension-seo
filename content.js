// SEO Social Optimizer AI - Content Script

(function () {
  let floatingBadge = null;
  let activeElement = null;
  let savedRange = null;
  let selectedText = "";
  let toastContainer = null;

  const SPARKLES_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display: block;"><path d="M9 21c-.5 0-.9-.3-1-.8l-1.2-4-4-1.2c-.5-.1-.8-.5-.8-1s.3-.9.8-1l4-1.2 1.2-4c.1-.5.5-.8 1-.8s.9.3 1 .8l1.2 4 4 1.2c.5.1.8.5.8 1s-.3.9-.8 1l-4 1.2-1.2 4c-.1.5-.5.8-1 .8zm8.5-12.5c-.3 0-.5-.2-.6-.4l-.6-2-2-.6c-.2-.1-.4-.3-.4-.6s.2-.5.4-.6l2-.6.6-2c.1-.2.3-.4.6-.4s.5.2.6.4l.6 2 2 .6c.2.1.4.3.4.6s-.2.5-.4.6l-2 .6-.6 2c-.1.2-.3.4-.6.4z"/></svg>`;
  const CHECK_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const ALERT_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  // Create floating badge element
  function createBadge() {
    if (floatingBadge) return;

    floatingBadge = document.createElement("div");
    floatingBadge.className = "seo-optimizer-floating-badge";
    floatingBadge.innerHTML = `
      <span class="seo-optimizer-badge-icon">${SPARKLES_SVG}</span>
      <span class="seo-optimizer-badge-text">Optimize</span>
    `;

    document.body.appendChild(floatingBadge);

    // Prevent badge clicks from destroying selection focus
    floatingBadge.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    floatingBadge.addEventListener("click", handleOptimizeClick);
  }

  // Hide the badge and reset its state
  function hideBadge() {
    if (floatingBadge && floatingBadge.classList.contains("visible")) {
      floatingBadge.classList.remove("visible", "loading", "success", "error");
      // Reset inner HTML
      const iconSpan = floatingBadge.querySelector(".seo-optimizer-badge-icon");
      const textSpan = floatingBadge.querySelector(".seo-optimizer-badge-text");
      if (iconSpan) iconSpan.innerHTML = SPARKLES_SVG;
      if (textSpan) textSpan.textContent = "Optimize";

      // Let selection remain unless explicitly cleared
    }
  }

  // Position the floating badge above the text selection
  function positionBadge() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return; // Hidden or invalid selection bounds

    const badgeWidth = 100; // Estimated width
    let left = rect.left + window.scrollX + rect.width / 2 - badgeWidth / 2;
    let top = rect.top + window.scrollY - 38; // 38px above selection

    // Boundary check: horizontal
    if (left < 10) left = 10;
    if (left + badgeWidth > window.innerWidth - 10) {
      left = window.innerWidth - badgeWidth - 10;
    }

    // Boundary check: vertical
    if (rect.top < 45) {
      // If selection is near top of viewport, place badge below the selection
      top = rect.bottom + window.scrollY + 8;
    }

    floatingBadge.style.left = `${left}px`;
    floatingBadge.style.top = `${top}px`;
    floatingBadge.classList.add("visible");
  }

  // Check if selection is valid and trigger badge
  function handleSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      selectedText = text;

      // Cache selection coordinates and target element
      activeElement = document.activeElement;
      savedRange = selection.getRangeAt(0).cloneRange();

      createBadge();
      // Wait a fraction of a second for selection drawing to finish
      setTimeout(positionBadge, 20);
    } else {
      // Only hide if the click wasn't on our badge itself
      hideBadge();
    }
  }

  // Replace selected text inside editable fields
  function replaceSelectedText(newText) {
    if (!activeElement) return false;

    // Standard DOM focus and range restoration
    activeElement.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);

    // Try standard insertText command (excellent react/social media framework support)
    try {
      const isReplaced = document.execCommand("insertText", false, newText);
      if (isReplaced) {
        // Dispatch standard input events to trigger reactive field state updates
        const inputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        activeElement.dispatchEvent(inputEvent);

        // Also fire change event
        const changeEvent = new Event("change", {
          bubbles: true,
          cancelable: true,
        });
        activeElement.dispatchEvent(changeEvent);

        return true;
      }
    } catch (e) {
      console.warn("[SEO Optimizer] execCommand failed:", e);
    }

    // Fallback: If it's a textarea or text input, set the value directly
    if (
      activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA"
    ) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const val = activeElement.value;

      activeElement.value =
        val.substring(0, start) + newText + val.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd =
        start + newText.length;

      const event = new Event("input", { bubbles: true });
      activeElement.dispatchEvent(event);
      return true;
    }

    return false;
  }

  // Handle the action of clicking the optimize button
  async function handleOptimizeClick(e) {
    if (!selectedText || floatingBadge.classList.contains("loading")) return;

    const iconSpan = floatingBadge.querySelector(".seo-optimizer-badge-icon");
    const textSpan = floatingBadge.querySelector(".seo-optimizer-badge-text");

    // Show loading state
    floatingBadge.className = "seo-optimizer-floating-badge visible loading";
    if (iconSpan)
      iconSpan.innerHTML = '<div class="seo-optimizer-spinner"></div>';
    if (textSpan) textSpan.textContent = "Optimizing...";

    // Communicate with background service worker to fetch SEO optimization
    chrome.runtime.sendMessage(
      { action: "optimize", text: selectedText },
      (response) => {
        if (chrome.runtime.lastError) {
          showErrorState("Offline");
          showToast("Connection failed. Service worker is inactive.", "error");
          return;
        }

        if (response && response.success) {
          // Success state on badge
          floatingBadge.className =
            "seo-optimizer-floating-badge visible success";
          if (iconSpan) iconSpan.innerHTML = CHECK_SVG;
          if (textSpan) textSpan.textContent = "Optimized!";

          // Replace text in-place
          const replaced = replaceSelectedText(response.optimizedText);

          if (replaced) {
            showToast(`SEO Optimized via ${response.provider}!`, "success");
          } else {
            // If in-place replacement failed (not in editable input), copy to clipboard
            navigator.clipboard.writeText(response.optimizedText);
            showToast(
              `SEO post copied to clipboard! (Generated via ${response.provider})`,
              "success",
            );
          }

          // Clear selection and hide badge after brief delay
          setTimeout(() => {
            hideBadge();
            window.getSelection().removeAllRanges();
          }, 1500);
        } else {
          // Error handling
          const errorMsg = response
            ? response.error
            : "Unknown connection error";
          console.error("[SEO Optimizer] Optimization failed:", errorMsg);
          showErrorState("Error");
          showToast(errorMsg || "Service offline", "error");
        }
      },
    );
  }

  // Set badge to error state
  function showErrorState(labelText) {
    floatingBadge.className = "seo-optimizer-floating-badge visible error";
    const iconSpan = floatingBadge.querySelector(".seo-optimizer-badge-icon");
    const textSpan = floatingBadge.querySelector(".seo-optimizer-badge-text");
    if (iconSpan) iconSpan.innerHTML = ALERT_SVG;
    if (textSpan) textSpan.textContent = labelText;
  }

  // Display a premium in-page toast notification
  function showToast(message, type = "success") {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = `seo-optimizer-toast ${type}`;
      document.body.appendChild(toastContainer);
    }

    toastContainer.className = `seo-optimizer-toast visible ${type}`;
    const icon = type === "success" ? "✨" : "⚠️";
    toastContainer.innerHTML = `
      <span class="seo-optimizer-toast-icon">${icon}</span>
      <span class="seo-optimizer-toast-message">${message}</span>
    `;

    // Clear previous timeouts if any
    if (window.toastTimeout) clearTimeout(window.toastTimeout);

    window.toastTimeout = setTimeout(() => {
      toastContainer.classList.remove("visible");
    }, 4000);
  }

  // Event Listeners
  document.addEventListener("mouseup", (e) => {
    // If the click is on the badge, ignore standard click-off dismissals
    if (floatingBadge && floatingBadge.contains(e.target)) return;

    // Execute selection check
    handleSelection();
  });

  // Track keyboard navigation selections (e.g. Shift + Arrow Keys)
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" || e.key.startsWith("Arrow")) {
      handleSelection();
    }
  });

  // Dismiss badge if clicking off it
  document.addEventListener("mousedown", (e) => {
    if (floatingBadge && !floatingBadge.contains(e.target)) {
      // Delay slightly to check if we clicked a new text selection area
      setTimeout(() => {
        const sel = window.getSelection().toString().trim();
        if (sel.length === 0) {
          hideBadge();
        }
      }, 50);
    }
  });

  // Handle escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideBadge();
    }
  });

  // Recalculate badge coordinates on resize or scroll to prevent detaching
  window.addEventListener("resize", () => {
    if (floatingBadge && floatingBadge.classList.contains("visible")) {
      positionBadge();
    }
  });

  console.log("[SEO Optimizer AI] Content Script injected successfully!");
})();
