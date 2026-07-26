/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A highly robust copy-to-clipboard helper that works in both standard browsers
 * and sandboxed iframe environments (such as Google AI Studio preview).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  // Method 1: Modern navigator.clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard failed, attempting fallback:", err);
    }
  }

  // Method 2: Fallback document.execCommand('copy') which is highly reliable inside sandboxed iframe previews
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling or visual disturbance when appending
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("All copy-to-clipboard attempts failed:", err);
    return false;
  }
}
