import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ffmpegService } from '../../services/ffmpeg';

type MediaProcessorModalProps = {
    isOpen: boolean;
    onClose: () => void;
    file: File;
    onProcessed: (newFile: File) => void;
};

type ProcessType = 'mp4' | 'mp3' | 'gif' | 'compress';

const PROCESS_OPTIONS = [
    { id: 'mp4', label: 'Convert to MP4', icon: '📹' },
    { id: 'mp3', label: 'Extract Audio (MP3)', icon: '🎵' },
    { id: 'gif', label: 'Create GIF', icon: '🖼️' },
    { id: 'compress', label: 'Compress Video', icon: '📉' },
];

export const MediaProcessorModal: React.FC<MediaProcessorModalProps> = ({ isOpen, onClose, file, onProcessed }) => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedType, setSelectedType] = useState<ProcessType | null>(null);

    const handleProcess = async (type: ProcessType) => {
        setStatus('processing');
        setProgress(0);
        setErrorMsg('');
        
        try {
            let result: File;
            
            switch (type) {
                case 'mp4':
                    result = await ffmpegService.convertToMP4(file, setProgress);
                    break;
                case 'mp3':
                    result = await ffmpegService.convertToMP3(file, setProgress);
                    break;
                case 'gif':
                    result = await ffmpegService.convertToGIF(file, setProgress);
                    break;
                case 'compress':
                    result = await ffmpegService.compressVideo(file, setProgress);
                    break;
                default:
                    throw new Error("Unknown operation");
            }
            
            setStatus('done');
            setTimeout(() => {
                onProcessed(result);
                onClose();
            }, 1000);
            
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            // Friendly error message for SharedArrayBuffer issue
            if (e.message && e.message.includes('SharedArrayBuffer')) {
                setErrorMsg("Browser security restriction: SharedArrayBuffer is not available. Please ensure the page is served with COOP/COEP headers.");
            } else {
                setErrorMsg(e.message || "Processing failed.");
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Media Tools</h3>
                                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl mb-6 flex items-center gap-3">
                                <div className="text-2xl">📄</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>

                            {status === 'idle' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {PROCESS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSelectedType(opt.id as ProcessType); handleProcess(opt.id as ProcessType); }}
                                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
                                        >
                                            <span className="text-2xl">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {status === 'processing' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-2">Processing Media...</p>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                                        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <p className="text-xs text-gray-500">{progress}%</p>
                                    <p className="text-xs text-gray-400 mt-2">Loading core files on first run may take a moment.</p>
                                </div>
                            )}

                            {status === 'done' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                                    <p className="text-green-600 font-medium">Complete!</p>
                                    <p className="text-sm text-gray-500">Replacing file attachment...</p>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✕</div>
                                    <p className="text-red-600 font-medium mb-2">Processing Failed</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                                        {errorMsg}
                                    </p>
                                    <button 
                                        onClick={() => setStatus('idle')}
                                        className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
