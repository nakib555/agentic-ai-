/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Search, Settings, MessageSquare, Plus, Moon, Sun, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const ui = useUIStore();
  const settings = useSettingsStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    command();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-[640px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <Command label="Command Palette">
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4">
                <Search className="w-5 h-5 text-slate-400 mr-3" />
                <Command.Input 
                  placeholder="Type a command or search..." 
                  className="w-full py-4 bg-transparent outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="p-4 text-center text-slate-500">No results found.</Command.Empty>
                
                <Command.Group heading="General" className="text-xs font-semibold text-slate-500 px-2 py-2 uppercase tracking-wider">
                  <Command.Item 
                    onSelect={() => runCommand(() => window.dispatchEvent(new CustomEvent('new-chat')))}
                    className="flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                  >
                    <Plus className="w-4 h-4 mr-3" />
                    <span>New Chat</span>
                    <kbd className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">⌘N</kbd>
                  </Command.Item>
                  
                  <Command.Item 
                    onSelect={() => runCommand(() => ui.setSettingsOpen(true))}
                    className="flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    <span>Settings</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Appearance" className="text-xs font-semibold text-slate-500 px-2 py-2 uppercase tracking-wider">
                  <Command.Item 
                    onSelect={() => runCommand(() => window.dispatchEvent(new CustomEvent('toggle-theme')))}
                    className="flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                  >
                    <Sun className="w-4 h-4 mr-3 dark:hidden" />
                    <Moon className="w-4 h-4 mr-3 hidden dark:block" />
                    <span>Toggle Theme</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Models" className="text-xs font-semibold text-slate-500 px-2 py-2 uppercase tracking-wider">
                  {settings.availableModels.slice(0, 5).map(model => (
                    <Command.Item 
                      key={model.id}
                      onSelect={() => runCommand(() => settings.setActiveModel(model.id))}
                      className="flex items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800"
                    >
                      <MessageSquare className="w-4 h-4 mr-3" />
                      <span>Switch to {model.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
          <div className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
        </div>
      )}
    </AnimatePresence>
  );
};
