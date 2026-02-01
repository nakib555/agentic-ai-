/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
import { FloatingPrompts } from './FloatingPrompts';
import { WelcomeLogo } from '../../UI/WelcomeLogo';

const motion = motionTyped as any;

type WelcomeScreenProps = {
  sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
};

export const WelcomeScreen = ({ sendMessage }: WelcomeScreenProps) => (
    <div className="flex flex-col items-center justify-center h-full text-center pb-12 px-4 relative overflow-y-auto custom-scrollbar">
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="mb-8"
        >
            <WelcomeLogo size={180} />
        </motion.div>
        
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="mb-12 space-y-3"
        >
            <h1 className="text-4xl sm:text-5xl font-bold font-['Space_Grotesk'] tracking-tight leading-tight text-slate-800 dark:text-slate-100">
                How can I help you today?
            </h1>
        </motion.div>
        
        <div className="w-full max-w-3xl">
             <FloatingPrompts 
                onPromptClick={(prompt, options) => sendMessage(prompt, undefined, options)} 
                isAgentMode={false}
             />
        </div>
    </div>
);