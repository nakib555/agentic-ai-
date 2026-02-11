
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

type AttachedFilePreviewProps = {
  file: File;
  onRemove: () => void;
  onPreview: () => void;
  onProcess?: () => void; // Optional process callback
  progress: number; // 0-100
  error: string | null;
};

// Enhanced visual styles map with better color coding for file types
const getFileVisuals = (file: File) => {
    const mime = file.type;
    const name = file.name.toLowerCase();
    const ext = name.split('.').pop()?.toUpperCase().substring(0, 4) || 'FILE';

    // Image
    if (mime.startsWith('image/')) {
        return { bg: 'bg-gradient-to-br from-indigo-400 to-cyan-400', text: 'text-white', label: 'IMG' };
    }
    
    // Video
    if (mime.startsWith('video/')) {
        return { bg: 'bg-gradient-to-br from-fuchsia-500 to-pink-500', text: 'text-white', label: 'VID' };
    }
    
    // Audio
    if (mime.startsWith('audio/')) {
        return { bg: 'bg-gradient-to-br from-amber-400 to-orange-500', text: 'text-white', label: 'AUD' };
    }
    
    // PDF
    if (mime === 'application/pdf') {
        return { bg: 'bg-gradient-to-br from-rose-500 to-red-600', text: 'text-white', label: 'PDF' };
    }
    
    // Word
    if (['doc', 'docx'].some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', text: 'text-white', label: 'DOC' };
    }

    // Excel
    if (['xls', 'xlsx', 'csv'].some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-emerald-500 to-green-600', text: 'text-white', label: 'XLS' };
    }

    // PowerPoint
    if (['ppt', 'pptx'].some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-orange-500 to-red-500', text: 'text-white', label: 'PPT' };
    }
    
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz'].some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-yellow-400 to-amber-500', text: 'text-white', label: 'ZIP' };
    }

    // Code
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'sh', 'rb', 'swift', 'sql', 'xml', 'md', 'yml', 'yaml', 'rs'];
    if (codeExtensions.some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-slate-700 to-slate-800', text: 'text-sky-300', label: ext };
    }
    
    // Text
    if (['txt', 'md', 'rtf'].some(e => name.endsWith('.' + e))) {
        return { bg: 'bg-gradient-to-br from-slate-400 to-slate-500', text: 'text-white', label: 'EXT' };
    }

    // Default
    return { bg: 'bg-gradient-to-br from-slate-400 to-slate-500', text: 'text-slate-100', label: ext };
};

export const AttachedFilePreview: React.FC<AttachedFilePreviewProps> = ({ file, onRemove, onPreview, onProcess, progress, error }) => {
    const isProcessing = progress < 100 && !error;
    const hasFailed = !!error;
    const visuals = getFileVisuals(file);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Is this a media file supported by FFmpeg tools?
    const isMedia = file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type === 'image/gif';

    useEffect(() => {
        if (!file.type.startsWith('image/')) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove();
    };
    
    const handleProcess = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onProcess) onProcess();
    };

    const handleClick = () => {
        if (!hasFailed && !isProcessing) {
            onPreview();
        }
    };

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.8, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 'auto' }}
            exit={{ opacity: 0, scale: 0.5, width: 0, transition: { duration: 0.15 } }}
            className="relative group pt-2 pr-2 pb-1 pl-1" 
        >
            <div 
                onClick={handleClick}
                className={`
                    relative w-16 h-16 rounded-2xl overflow-hidden cursor-pointer
                    shadow-md border border-slate-300 dark:border-slate-500 ring-1 ring-black/5 dark:ring-white/5
                    transform transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-lg
                    ${hasFailed ? 'opacity-80 grayscale' : ''}
                    ${visuals.bg}
                `}
                title={file.name}
            >
                {/* File Visual Content */}
                {previewUrl ? (
                    <div className="absolute inset-0 bg-white/10">
                        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <span className={`text-[9px] font-black tracking-wider uppercase ${visuals.text} opacity-90 drop-shadow-sm truncate max-w-full`}>
                            {visuals.label}
                        </span>
                    </div>
                )}

                {/* Processing Overlay */}
                <AnimatePresence>
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10"
                        >
                            <svg className="w-6 h-6 -rotate-90 text-white" viewBox="0 0 36 36">
                                <path
                                    className="text-white/20"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                                <motion.path
                                    className="text-white drop-shadow-md"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeDasharray="100, 100"
                                    initial={{ strokeDashoffset: 100 }}
                                    animate={{ strokeDashoffset: 100 - progress }}
                                />
                            </svg>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error Overlay */}
                {hasFailed && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-red-500 drop-shadow-sm">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
            
            {/* Tools Container */}
            <div className="absolute top-0 right-0 z-20 flex gap-1 transform scale-90 group-hover:scale-100 transition-transform">
                {/* Process Button (Media only) */}
                {isMedia && !hasFailed && !isProcessing && (
                     <button
                        type="button"
                        onClick={handleProcess}
                        aria-label={`Process ${file.name}`}
                        className="
                            w-6 h-6 rounded-full 
                            bg-white dark:bg-zinc-800 
                            text-indigo-500 dark:text-indigo-400
                            hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white
                            shadow-md border border-slate-200 dark:border-slate-600
                            flex items-center justify-center transition-colors duration-200
                            cursor-pointer
                        "
                        title="Process Media (Convert/Compress)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                    </button>
                )}

                {/* Remove Button */}
                <button
                    type="button"
                    onClick={handleRemove}
                    aria-label={`Remove ${file.name}`}
                    className="
                        w-6 h-6 rounded-full 
                        bg-white dark:bg-zinc-800 
                        text-slate-500 dark:text-slate-400
                        hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white
                        shadow-md border border-slate-200 dark:border-slate-600
                        flex items-center justify-center transition-colors duration-200
                        cursor-pointer
                    "
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                </button>
            </div>
        </motion.div>
    );
};