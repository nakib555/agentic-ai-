/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type ConfirmationModalProps = {
  isOpen: boolean;
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, prompt, onConfirm, onCancel, destructive = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white dark:bg-layer-1 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-white/10 flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2">Confirm Action</h3>
              <p className="text-sm text-gray-600 dark:text-slate-300">{prompt}</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-white/10 rounded-b-2xl">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors border border-gray-300 dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                  destructive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};