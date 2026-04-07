/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type FilePreviewProps = {
  filename: string;
  srcUrl: string;
  mimeType: string;
};

export const FilePreview: React.FC<FilePreviewProps> = ({ filename, srcUrl, mimeType }) => {
  const handleDownload = () => {
    if (!srcUrl) return;
    const link = document.createElement('a');
    link.href = srcUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPreviewContent = () => {
    if (!srcUrl) {
      return <p className="p-4 text-sm text-red-500 dark:text-red-400">File source is missing.</p>;
    }
    if (mimeType.startsWith('image/')) {
      return <img src={srcUrl} alt={filename} className="max-h-[60vh] w-auto h-auto object-contain" />;
    }
    if (mimeType === 'application/pdf' || mimeType === 'text/html') {
        return <iframe src={srcUrl} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="w-full h-[60vh] border-none bg-white" title={filename} />;
    }
    return <p className="p-4 text-sm text-slate-400">No preview available for this file type.</p>;
  };

  return (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-lg bg-white dark:bg-[#1e1e1e]"
    >
        <div className="bg-gray-50 dark:bg-black/20 flex items-center justify-center p-2">
            {renderPreviewContent()}
        </div>
        <div className="p-3 bg-white dark:bg-[#202123]/50 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate" title={filename}>{filename}</span>
            <button
                onClick={handleDownload}
                disabled={!srcUrl}
                className="flex-shrink-0 p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Download ${filename}`}
                aria-label={`Download ${filename}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                <span className="sr-only">Download</span>
            </button>
        </div>
    </motion.div>
  );
};