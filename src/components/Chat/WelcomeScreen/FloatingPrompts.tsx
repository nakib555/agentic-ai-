
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
import { PromptButton, type PromptColor } from './PromptButton';
const motion = motionTyped as any;

type FloatingPromptsProps = {
  onPromptClick: (prompt: string, options?: { isThinkingModeEnabled?: boolean }) => void;
  isAgentMode: boolean; // Retained for compatibility but ignored
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.4,
        staggerChildren: 0.08,
      },
    },
};

const CHAT_PROMPTS: { icon: string; text: string; prompt: string; color: PromptColor }[] = [
    {
        icon: "📊",
        text: "Sales Trend",
        prompt: "Create a visually appealing bar chart comparing quarterly sales: Q1 12k, Q2 19k, Q3 15k, Q4 25k.",
        color: "indigo"
    },
    {
        icon: "🧬",
        text: "Network Viz",
        prompt: "Create a D3.js force-directed graph visualization with 8 nodes and random links.",
        color: "emerald"
    },
    {
        icon: "🧊",
        text: "3D Plot",
        prompt: "Generate a 3D surface plot of the function z = sin(x) * cos(y).",
        color: "blue"
    },
    {
        icon: "📉",
        text: "Stock Analysis",
        prompt: "Simulate a stock price movement over 30 days and visualize it with a candlestick chart.",
        color: "rose"
    },
    {
        icon: "⚛️",
        text: "Explain Quantum",
        prompt: "Explain quantum computing in simple terms.",
        color: "cyan"
    },
    {
        icon: "🚀",
        text: "Startup Ideas",
        prompt: "Help me brainstorm names for a tech startup focused on sustainability.",
        color: "amber"
    }
];

export const FloatingPrompts = ({ onPromptClick }: FloatingPromptsProps) => {
  const prompts = CHAT_PROMPTS;

  const handleClick = (prompt: string) => {
      console.log('[FloatingPrompts] Clicked prompt:', prompt);
      try {
          onPromptClick(prompt, { isThinkingModeEnabled: false });
      } catch (e) {
          console.error('[FloatingPrompts] Error triggering prompt click:', e);
      }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="flex flex-wrap justify-center gap-3 w-full max-w-5xl mx-auto"
    >
        {prompts.map((p, i) => (
            <PromptButton 
                key={i} 
                icon={p.icon} 
                text={p.text} 
                color={p.color}
                onClick={() => handleClick(p.prompt)} 
            />
        ))}
    </motion.div>
  );
};
