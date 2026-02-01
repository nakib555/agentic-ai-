
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
import { FloatingPrompts } from './FloatingPrompts';

const motion = motionTyped as any;

type WelcomeScreenProps = {
  sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
};

export const WelcomeScreen = ({ sendMessage }: WelcomeScreenProps) => (
    <div className="flex flex-col items-center justify-center h-full text-center pb-12 px-4 relative overflow-y-auto custom-scrollbar">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="mb-12 space-y-3"
        >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-['Space_Grotesk'] tracking-tight leading-tight">
                <span className="text-slate-800 dark:text-slate-100">How can </span>
                <span className="brand-gradient">I help you?</span>
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto">
                Your intelligent companion for conversation and knowledge.
            </p>
        </motion.div>
        
        <div className="w-full max-w-3xl">
             <FloatingPrompts 
                onPromptClick={(prompt, options) => sendMessage(prompt, undefined, options)} 
                isAgentMode={false}
             />
        </div>
    </div>
);
