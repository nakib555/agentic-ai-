
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
const motion = motionTyped as any;

export const TypingIndicator = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center px-4 py-2"
      aria-label="AI is thinking"
      role="status"
    >
      <span className="text-lg font-medium shimmer-text select-none">
        Thinking....
      </span>
    </motion.div>
  );
