
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion as motionTyped, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion';
import { useViewport } from '../../../hooks/useViewport';
import type { ProcessedFile } from './types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSyntaxTheme } from '../../../hooks/useSyntaxTheme';

const motion = motionTyped as any;

type FilePreviewSidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    file: ProcessedFile | null;
};

// Static styles
const CUSTOM_STYLE = { 
    margin: 0, 
    padding: '1.5rem', 
    minHeight: '100%', 
    fontSize: '13px', 
    fontFamily: "'Fira Code', monospace",
    background: 'transparent',
};

const CODE_TAG_PROPS = { 
    style: { fontFamily: "inherit" } 
};

export const FilePreviewSidebar: React.FC<FilePreviewSidebarProps> = ({ 
    isOpen, 
    onClose, 
    file 
}) => {
    const { isDesktop } = useViewport();
    const [content, setContent] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'image' | 'text' | 'pdf' | 'other'>('other');
    const [language, setLanguage] = useState('text');
    const [isCopied, setIsCopied] = useState(false);
    const syntaxStyle = useSyntaxTheme();
    const dragControls = useDragControls();
    
    // Mobile State
    const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight : 800);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!file || !file.file) {
            setContent(null);
            return;
        }

        const rawFile = file.file;
        const ext = rawFile.name.split('.').pop()?.toLowerCase();

        if (rawFile.type.startsWith('image/')) {
            setPreviewType('image');
            if (file.base64Data) {
                setContent(`data:${rawFile.type};base64,${file.base64Data}`);
            } else {
                const url = URL.createObjectURL(rawFile);
                setContent(url);
                return () => URL.revokeObjectURL(url);
            }
            return;
        }

        if (rawFile.type === 'application/pdf') {
            setPreviewType('pdf');
            const url = URL.createObjectURL(rawFile);
            setContent(url);
            return () => URL.revokeObjectURL(url);
        }

        if (
            rawFile.type.startsWith('text/') || 
            rawFile.name.match(/\.(json|js|jsx|ts|tsx|css|html|md|py|rb|java|c|cpp|h|txt|csv|xml|yaml|yml|log|env|ini|conf)$/i)
        ) {
            setPreviewType('text');
            
            // Detect language for syntax highlighter
            let detectedLang = 'text';
            switch(ext) {
                case 'js': case 'jsx': detectedLang = 'javascript'; break;
                case 'ts': case 'tsx': detectedLang = 'typescript'; break;
                case 'py': detectedLang = 'python'; break;
                case 'rb': detectedLang = 'ruby'; break;
                case 'java': detectedLang = 'java'; break;
                case 'c': case 'h': detectedLang = 'c'; break;
                case 'cpp': detectedLang = 'cpp'; break;
                case 'css': detectedLang = 'css'; break;
                case 'html': case 'xml': case 'svg': detectedLang = 'markup'; break; // Map HTML to markup
                case 'json': detectedLang = 'json'; break;
                case 'md': detectedLang = 'markdown'; break;
                case 'sql': detectedLang = 'sql'; break;
                case 'sh': case 'bash': detectedLang = 'bash'; break;
                case 'yaml': case 'yml': detectedLang = 'yaml'; break;
                default: detectedLang = 'text';
            }
            setLanguage(detectedLang);

            if (file.base64Data) {
                try {
                    const decoded = new TextDecoder().decode(
                        Uint8Array.from(atob(file.base64Data), c => c.charCodeAt(0))
                    );
                    setContent(decoded);
                } catch (e) {
                    setContent('Error decoding text content.');
                }
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result;
                    if (typeof result === 'string') setContent(result);
                };
                reader.readAsText(rawFile);
            }
            return;
        }

        setPreviewType('other');
    }, [file]);

    const handleDownload = () => {
        if (!file?.file) return;
        const url = URL.createObjectURL(file.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        if (content && previewType === 'text') {
            navigator.clipboard.writeText(content).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            });
        }
    };

    // Mobile Sheet Logic
    useLayoutEffect(() => {
        if (isDesktop) return;

        const vh = window.innerHeight;
        const MAX_H = vh * 0.85; 
        const MIN_H = vh * 0.45;

        if (isOpen) {
            const actualHeight = contentRef.current?.scrollHeight || 0;
            const targetHeight = Math.min(Math.max(actualHeight, MIN_H), MAX_H);
            const targetY = MAX_H - targetHeight;
            
            animate(y, targetY, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            animate(y, MAX_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    }, [isOpen, isDesktop, content, file, y]);

    const onDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
        if (isDesktop) return;

        const vh = window.innerHeight;
        const MAX_H = vh * 0.85;
        const MIN_H = vh * 0.45;
        const currentY = y.get();
        const velocityY = info.velocity.y;

        const closingThreshold = MAX_H - (MIN_H / 2);

        if (velocityY > 300 || currentY > closingThreshold) {
            onClose();
        } else if (currentY < (MAX_H - MIN_H) / 2) {
            // Snap to Max
            animate(y, 0, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            // Snap to Min
            animate(y, MAX_H - MIN_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    };

    const desktopVariants = {
        closed: { x: '100%', opacity: 0 },
        open: { x: 0, opacity: 1 }
    };

    if (!file) return null;
    if (!isDesktop && !isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity ${isDesktop ? 'bg-black/30' : ''}`}
                    />

                    {/* Container */}
                    <motion.div
                        initial={isDesktop ? "closed" : undefined}
                        animate={isDesktop ? "open" : undefined}
                        exit={isDesktop ? "closed" : undefined}
                        variants={isDesktop ? desktopVariants : undefined}
                        style={!isDesktop ? { y, height: '85dvh', maxHeight: '85dvh' } : {}}
                        transition={isDesktop ? { type: "spring", stiffness: 300, damping: 30 } : undefined}
                        drag={!isDesktop ? "y" : false}
                        dragListener={false}
                        dragControls={dragControls}
                        dragConstraints={{ top: 0, bottom: (typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800) }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={onDragEnd}
                        className={`
                            fixed z-[70] bg-page shadow-2xl flex flex-col overflow-hidden
                            ${isDesktop 
                                ? 'top-0 right-0 h-full w-[600px] max-w-[90vw] border-l border-border-subtle' 
                                : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-subtle'
                            }
                        `}
                    >
                        <div 
                            ref={contentRef}
                            className="flex flex-col h-full overflow-hidden w-full"
                        >
                            {/* Drag Handle for Mobile */}
                            {!isDesktop && (
                                <div 
                                    className="flex justify-center pt-3 pb-2 bg-layer-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none w-full" 
                                    onPointerDown={(e: any) => dragControls.start(e)}
                                    onClick={onClose}
                                >
                                    <div className="w-12 h-1.5 rounded-full bg-border-strong/50"></div>
                                </div>
                            )}

                            {/* Header */}
                            <div className={`flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-layer-2 flex-shrink-0 w-full ${!isDesktop ? 'pt-2' : ''}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-2 bg-primary-subtle rounded-xl text-primary-main flex-shrink-0">
                                        {previewType === 'image' ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                        ) : previewType === 'text' ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h3 className="text-sm font-bold text-content-primary truncate max-w-[200px]" title={file.file.name}>{file.file.name}</h3>
                                        <p className="text-[10px] font-medium text-content-secondary uppercase tracking-wide">
                                            {(file.file.size / 1024).toFixed(1)} KB • {file.file.type || 'UNKNOWN'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {previewType === 'text' && (
                                        <button
                                            onClick={handleCopy}
                                            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-layer-3 transition-colors"
                                            title="Copy content"
                                        >
                                            {isCopied ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                            )}
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={handleDownload}
                                        className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-layer-3 transition-colors"
                                        title="Download file"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>

                                    <div className="w-px h-4 bg-border-strong mx-1"></div>

                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-layer-3 transition-colors"
                                        aria-label="Close"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                            <path d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Content Viewer */}
                            <div className="flex-1 overflow-auto bg-layer-1 flex flex-col relative w-full">
                                {previewType === 'image' && content && (
                                    <div className="flex-1 flex items-center justify-center p-4 min-h-[300px]">
                                        <img src={content} alt={file.file.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                                    </div>
                                )}
                                
                                {previewType === 'pdf' && content && (
                                    <div className="flex-1 w-full h-full p-4">
                                        <iframe src={content} title={file.file.name} className="w-full h-full min-h-[400px] rounded-lg border-none bg-white shadow-sm" />
                                    </div>
                                )}

                                {previewType === 'text' && content && (
                                    <div className="absolute inset-0 overflow-auto custom-scrollbar bg-code-surface">
                                        <SyntaxHighlighter
                                            language={language}
                                            style={syntaxStyle}
                                            customStyle={CUSTOM_STYLE}
                                            codeTagProps={CODE_TAG_PROPS}
                                            wrapLongLines={true}
                                        >
                                            {content}
                                        </SyntaxHighlighter>
                                    </div>
                                )}

                                {previewType === 'other' && (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <div className="w-20 h-20 bg-layer-2 rounded-full flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-content-tertiary">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                            </svg>
                                        </div>
                                        <h4 className="text-lg font-semibold text-content-primary mb-1">No preview available</h4>
                                        <p className="text-content-secondary max-w-xs mx-auto">This file type cannot be previewed directly. Please download the file to view it.</p>
                                        <button 
                                            onClick={handleDownload}
                                            className="mt-6 px-6 py-2 bg-primary-main hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                                        >
                                            Download File
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
