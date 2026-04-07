
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type UploadMenuProps = {
  menuRef: React.RefObject<HTMLDivElement>;
  onFileClick: () => void;
  onFolderClick: () => void;
};

export const UploadMenu: React.FC<UploadMenuProps> = ({ menuRef, onFileClick, onFolderClick }) => (
  <motion.div
    ref={menuRef}
    initial={{ opacity: 0, y: 15, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 15, scale: 0.95 }}
    transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 25 }}
    className="absolute bottom-full left-0 mb-3 w-64 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 p-2 z-30 overflow-hidden"
  >
    <div className="px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        Upload
    </div>
    
    <div className="flex flex-col gap-1">
      <button
        onClick={onFileClick}
        aria-label="Upload files"
        className="group flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 text-left"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform border border-blue-100 dark:border-blue-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
            </svg>
        </div>
        <div>
            <span className="block font-semibold text-slate-700 dark:text-slate-200 text-sm">Files</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Upload documents or images</span>
        </div>
      </button>

      <button
        onClick={onFolderClick}
        aria-label="Upload folder"
        className="group flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 text-left"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform border border-amber-100 dark:border-amber-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
            </svg>
        </div>
        <div>
            <span className="block font-semibold text-slate-700 dark:text-slate-200 text-sm">Folder</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Upload entire directories</span>
        </div>
      </button>
    </div>
  </motion.div>
);
