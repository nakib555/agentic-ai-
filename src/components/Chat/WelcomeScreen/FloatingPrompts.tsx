
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
        icon: "⚛️",
        text: "Explain Quantum",
        prompt: "Explain quantum computing in simple terms.",
        color: "cyan"
    },
    {
        icon: "✍️",
        text: "Creative Writer",
        prompt: "Write a haiku about a robot learning to love.",
        color: "fuchsia"
    },
    {
        icon: "🍵",
        text: "Health Tips",
        prompt: "What are the health benefits of green tea?",
        color: "emerald"
    },
    {
        icon: "🚀",
        text: "Startup Ideas",
        prompt: "Help me brainstorm names for a tech startup focused on sustainability.",
        color: "blue"
    },
    {
        icon: "📚",
        text: "Literature",
        prompt: "Summarize the plot of 'The Great Gatsby' in 3 sentences.",
        color: "amber"
    },
    {
        icon: "🎌",
        text: "Translator",
        prompt: "Translate 'Hello, how are you?' into Japanese, French, and Spanish.",
        color: "rose"
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
