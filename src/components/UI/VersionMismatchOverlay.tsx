/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

export const VersionMismatchOverlay: React.FC = () => {
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    try {
        // Unregister all service workers to ensure a clean slate
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
        // Force reload from server
        window.location.reload();
    } catch (e) {
        console.error("Error clearing service worker:", e);
        window.location.reload();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 text-center"
      aria-live="assertive"
      role="alertdialog"
      aria-labelledby="version-mismatch-title"
      aria-describedby="version-mismatch-description"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, ease: 'easeOut' }}
        className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-600 dark:text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.691V5.25a3.375 3.375 0 00-3.375-3.375H8.25a3.375 3.375 0 00-3.375 3.375v2.25" />
            </svg>
        </div>
        <h2 id="version-mismatch-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Update Required
        </h2>
        <p id="version-mismatch-description" className="mt-2 text-slate-600 dark:text-slate-400">
          A new version of the application is available. Please refresh the page to continue.
        </p>
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="mt-6 w-full px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isReloading ? 'Updating...' : 'Refresh Page'}
        </button>
      </motion.div>
    </motion.div>
  );
};