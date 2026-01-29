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
            
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className={cn("w-full h-12", triggerClassName)}>
                    <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                    {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id} className="py-2.5">
                            <div className="flex flex-col text-left">
                                <span className="font-semibold">{opt.label}</span>
                                {opt.desc && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {opt.desc}
                                    </span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};