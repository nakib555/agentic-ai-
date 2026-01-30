/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { cn } from "../../lib/utils";

type SelectDropdownProps = {
    label?: string;
    icon?: React.ReactNode;
    startIcon?: React.ReactNode;
    options: { id: string; label: string; desc?: string }[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
    placeholder?: string;
    id?: string; // Added id prop
};

export const SelectDropdown: React.FC<SelectDropdownProps> = ({ 
    label, 
    icon, 
    startIcon,
    options, 
    value, 
    onChange, 
    disabled, 
    className = '',
    triggerClassName,
    placeholder = "Select an option",
    id
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
            
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger id={id} className={cn("w-full h-12", triggerClassName)}>
                    <div className="flex items-center gap-2.5 truncate">
                        {startIcon && (
                            <span className="flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                                {startIcon}
                            </span>
                        )}
                        <SelectValue placeholder={placeholder} />
                    </div>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                    {options.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No options available</p>
                        </div>
                    ) : (
                        options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id} className="py-2.5">
                                <div className="flex flex-col text-left">
                                    <span className="font-semibold">{opt.label}</span>
                                    {opt.desc && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[240px]">
                                            {opt.desc}
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
        </div>
    );
};
