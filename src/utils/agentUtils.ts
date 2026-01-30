
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This file is deprecated as specific agent personas have been removed.
// Keeping an empty object export to prevent build errors in legacy imports if any exist.

export const getAgentColor = (agentName: string) => {
  return { bg: 'bg-slate-100 dark:bg-white/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200' };
};
