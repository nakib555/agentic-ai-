/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for merging Tailwind classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type SelectDropdownProps = {
    label?: string;
    icon?: React.ReactNode;
    options: { id: string; label: string; desc?: string }[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
};

export const SelectDropdown: React.FC<SelectDropdownProps> = ({ 
    label, 
    icon, 
    options, 
    value, 
    onChange, 
    disabled, 
    className = '',
    triggerClassName
}) => {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {label && (
                <div className="flex items-center gap-2 px-1">
                    {icon && <span className="flex-shrink-0 text-slate-500 dark:text-slate-400 scale-90">{icon}</span>}
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {label}
                    </label>
                </div>
            )}
            
            <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
                <Select.Trigger 
                    className={cn(
                        "inline-flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-all outline-none",
                        "bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10",
                        "text-slate-700 dark:text-slate-200 font-medium",
                        "hover:border-indigo-300 dark:hover:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/20",
                        "data-[placeholder]:text-slate-400",
                        disabled && "opacity-50 cursor-not-allowed",
                        triggerClassName
                    )}
                >
                    <Select.Value placeholder="Select an option" />
                    <Select.Icon className="text-slate-400 dark:text-slate-500">
                        <ChevronDown className="h-4 w-4 opacity-70" />
                    </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                    <Select.Content 
                        className="z-[9999] overflow-hidden bg-white dark:bg-[#1e1e1e] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 ring-1 ring-black/5"
                        position="popper"
                        sideOffset={5}
                    >
                        <Select.Viewport className="p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {options.map((opt) => (
                                <Select.Item 
                                    key={opt.id} 
                                    value={opt.id}
                                    className={cn(
                                        "relative flex flex-col select-none rounded-lg pl-8 pr-4 py-2.5 text-sm outline-none cursor-pointer",
                                        "data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-white/10",
                                        "data-[state=checked]:text-indigo-600 dark:data-[state=checked]:text-indigo-400"
                                    )}
                                >
                                    <Select.ItemText>
                                        <span className="font-semibold block truncate">{opt.label}</span>
                                        {opt.desc && <span className="text-xs text-slate-500 dark:text-slate-400 block truncate mt-0.5">{opt.desc}</span>}
                                    </Select.ItemText>
                                    
                                    <Select.ItemIndicator className="absolute left-2 top-3 inline-flex items-center justify-center">
                                        <Check className="h-4 w-4" />
                                    </Select.ItemIndicator>
                                </Select.Item>
                            ))}
                        </Select.Viewport>
                    </Select.Content>
                </Select.Portal>
            </Select.Root>
        </div>
    );
};