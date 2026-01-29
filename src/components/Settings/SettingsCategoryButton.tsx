
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type SettingsCategoryButtonProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export const SettingsCategoryButton: React.FC<SettingsCategoryButtonProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 outline-none select-none ${
      isActive 
        ? 'text-primary-main' 
        : 'text-content-secondary hover:text-content-primary'
    }`}
  >
    {isActive && (
      <motion.div
        layoutId="settings-active-pill"
        className="absolute inset-0 bg-layer-2 shadow-sm border border-border-subtle rounded-lg"
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
    
    {/* Hover State Background */}
    <div className={`absolute inset-0 rounded-lg transition-opacity duration-200 ${isActive ? 'opacity-0' : 'bg-layer-2 opacity-0 group-hover:opacity-100'}`} />

    {/* Icon Container */}
    <span className={`relative z-10 flex items-center justify-center w-5 h-5 transition-all duration-300 ${
        isActive 
            ? 'text-primary-main scale-105' 
            : 'text-content-tertiary group-hover:text-content-secondary'
    }`}>
        {icon}
    </span>

    <span className="relative z-10 tracking-wide whitespace-nowrap">{label}</span>
  </button>
);
