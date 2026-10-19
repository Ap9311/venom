/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Utility to enforce cursor positioning on controlled React inputs & textareas.
 * Prevents caret resets (which cause reversed text like 'Hii' -> 'iiH') across WebKit,
 * Framer Motion, and re-rendering parent components.
 */
export function handleInputWithCursor<
  T extends HTMLInputElement | HTMLTextAreaElement
>(
  e: React.ChangeEvent<T>,
  setter: (value: string) => void
) {
  const target = e.target;
  const value = target.value;
  const cursor = target.selectionStart;

  setter(value);

  if (cursor !== null) {
    // Preserve selection range on the next animation frame after React reconciliation
    requestAnimationFrame(() => {
      try {
        if (document.activeElement === target) {
          target.setSelectionRange(cursor, cursor);
        }
      } catch (err) {
        // Ignore setSelectionRange errors for input types that don't support selection range
      }
    });
  }
}
