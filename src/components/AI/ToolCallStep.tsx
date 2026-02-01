
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion as motionTyped } from 'framer-motion';
const motion = motionTyped as any;
import type { ToolCallEvent } from '../../types';
import { ManualCodeRenderer } from '../Markdown/ManualCodeRenderer';
import { WorkflowMarkdownComponents } from '../Markdown/markdownComponents';
import { LocationPermissionRequest } from './LocationPermissionRequest';
import { MapDisplay } from './MapDisplay';
import { ImageDisplay } from './ImageDisplay';
import { VideoDisplay } from './VideoDisplay';
import { ErrorDisplay } from '../UI/ErrorDisplay';
import { CodeExecutionResult } from './CodeExecutionResult';
import { CodeBlock } from '../Markdown/CodeBlock';
import { VeoApiKeyRequest } from './VeoApiKeyRequest';
import { BrowserSessionDisplay } from './BrowserSessionDisplay';

const LoadingDots = () => (
    <div className="flex gap-1 items-center">
        <motion.div className="w-1 h-1 bg-gray-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0 }} />
        <motion.div className="w-1 h-1 bg-gray-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} />
        <motion.div className="w-1 h-1 bg-gray-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} />
    </div>
);

const RESULT_TRUNCATE_LENGTH = 300; // characters

type ToolResultDisplayProps = {
    result: string;
    sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
    onRegenerate: () => void;
};

const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({ result, sendMessage, onRegenerate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Check for special component tags first to render visual elements
    const imageMatch = result.match(/\[IMAGE_COMPONENT\](\{.*?\})\[\/IMAGE_COMPONENT\]/s);
    if (imageMatch && imageMatch[1]) {
        try {
            const imageData = JSON.parse(imageMatch[1]);
            return <ImageDisplay {...imageData} />;
        } catch (e) {
            return <ErrorDisplay error={{ message: 'Failed to render image component.', details: `Invalid JSON: ${e}` }} />;
        }
    }

    // Check for Map component
    const mapMatch = result.match(/<map>(.*?)<\/map>/s);
    if (mapMatch && mapMatch[1]) {
        try {
            const mapData = JSON.parse(mapMatch[1]);
            return <MapDisplay {...mapData} />;
        } catch (e) {
            return <ErrorDisplay error={{ message: 'Failed to render map component.', details: `Invalid JSON: ${e}` }} />;
        }
    }

    const browserMatch = result.match(/\[BROWSER_COMPONENT\](\{.*?\})\[\/BROWSER_COMPONENT\]/s);
    if (browserMatch && browserMatch[1]) {
        try {
            const browserData = JSON.parse(browserMatch[1]);
            const restOfContent = result.replace(browserMatch[0], '').trim();
            return (
                <div className="w-full">
                    <BrowserSessionDisplay {...browserData} />
                    {restOfContent && (
                         <div className="mt-4 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                            <ManualCodeRenderer text={restOfContent.length > RESULT_TRUNCATE_LENGTH && !isExpanded ? `${restOfContent.substring(0, RESULT_TRUNCATE_LENGTH)}...` : restOfContent} components={WorkflowMarkdownComponents} isStreaming={false} />
                             {restOfContent.length > RESULT_TRUNCATE_LENGTH && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-2"
                                    aria-expanded={isExpanded}
                                >
                                    {isExpanded ? 'Show Less' : 'Show More'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            );
        } catch (e) {
            return <ErrorDisplay error={{ message: 'Failed to render browser component.', details: `Invalid JSON: ${e}` }} />;
        }
    }

    const videoMatch = result.match(/\[VIDEO_COMPONENT\](\{.*?\})\[\/VIDEO_COMPONENT\]/s);
    if (videoMatch && videoMatch[1]) {
        try {
            const videoData = JSON.parse(videoMatch[1]);
            return <VideoDisplay {...videoData} />;
        } catch (e) {
            return <ErrorDisplay error={{ message: 'Failed to render video component.', details: `Invalid JSON: ${e}` }} />;
        }
    }
    
    const codeOutputMatch = result.match(/\[CODE_OUTPUT_COMPONENT\](\{.*?\})\[\/CODE_OUTPUT_COMPONENT\]/s);
    if (codeOutputMatch && codeOutputMatch[1]) {
        try {
            const codeOutputData = JSON.parse(codeOutputMatch[1]);
            return <CodeExecutionResult {...codeOutputData} />;
        } catch (e) {
            return <ErrorDisplay error={{ message: 'Failed to render code output component.', details: `Invalid JSON: ${e}` }} />;
        }
    }

    // Check for Veo API key request
    const veoKeyRequestMatch = result.match(/\[VEO_API_KEY_SELECTION_COMPONENT\](.*?)\[\/VEO_API_KEY_SELECTION_COMPONENT\]/s);
    if (veoKeyRequestMatch) {
        const text = veoKeyRequestMatch[1];
        return <VeoApiKeyRequest text={text} onRegenerate={onRegenerate} />;
    }

    // Check for the special location permission request tag
    const permissionRequestMatch = result.match(/\[LOCATION_PERMISSION_REQUEST\](.*?)\[\/LOCATION_PERMISSION_REQUEST\]/s);

    if (permissionRequestMatch) {
        const text = permissionRequestMatch[1];
        return <LocationPermissionRequest text={text} sendMessage={sendMessage} />;
    }
    
    // Check if the result is a tool error
    const isError = result.startsWith('Tool execution failed');
    if (isError) {
        return (
             <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1 uppercase tracking-wider">Failure</p>
                <p className="text-sm text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">{result}</p>
                <button 
                    onClick={onRegenerate}
                    className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 flex items-center gap-1 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
                    Retry
                </button>
            </div>
        )
    }

    const isLongResult = result.length > RESULT_TRUNCATE_LENGTH;
    const displayedResult = isLongResult && !isExpanded 
        ? `${result.substring(0, RESULT_TRUNCATE_LENGTH)}...` 
        : result;

    return (
        <div className="mt-2">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">Output</p>
            <div className="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 workflow-markdown font-mono break-words whitespace-pre-wrap">
                    <ManualCodeRenderer text={displayedResult} components={WorkflowMarkdownComponents} isStreaming={false} />
                </div>
                {isLongResult && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-2 flex items-center gap-1"
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? 'Show Less' : 'Show Full Output'}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};


type ToolCallStepProps = {
    event: ToolCallEvent;
    sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
    onRegenerate?: (messageId: string) => void;
    messageId?: string;
};

export const ToolCallStep = ({ event, sendMessage, onRegenerate, messageId }: ToolCallStepProps) => {
    const { call, result, browserSession } = event;
    const { args } = call;

    const handleRegenerate = () => {
        if (onRegenerate && messageId) {
            onRegenerate(messageId);
        }
    };

    // Special rendering for the 'displayMap' tool call to embed the map directly.
    if (call.name === 'displayMap' && args) {
        const { latitude, longitude, zoom, markerText } = args as { latitude: number, longitude: number, zoom?: number, markerText?: string };
        return <MapDisplay latitude={latitude} longitude={longitude} zoom={zoom ?? 13} markerText={markerText} />;
    }
    
    // Special rendering for live browser session
    if (call.name === 'browser' && browserSession) {
        return (
            <div className="w-full">
               <BrowserSessionDisplay 
                   url={browserSession.url}
                   title={browserSession.title || 'Loading...'}
                   screenshot={browserSession.screenshot || ''}
                   logs={browserSession.logs}
               />
               {/* If completed and there is result text, show it too */}
               {result && !result.startsWith('[BROWSER_COMPONENT]') && (
                   <div className="mt-4">
                       <ToolResultDisplay result={result} sendMessage={sendMessage} onRegenerate={handleRegenerate} />
                   </div>
               )}
            </div>
        );
    }
    
    // Special full-width rendering for code execution
    if (call.name === 'executeCode' && args && args.code) {
        const packages = (args.packages as string[] | undefined) || [];
        return (
            <div className="space-y-3">
                <CodeBlock language={args.language as string || 'plaintext'} isStreaming={false}>{args.code as string}</CodeBlock>
                {packages.length > 0 && (
                     <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Dependencies:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {packages.map((pkg, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 font-mono rounded text-slate-700 dark:text-slate-300">
                                {String(pkg)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {result ? (
                    <ToolResultDisplay result={result} sendMessage={sendMessage} onRegenerate={handleRegenerate} />
                ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <LoadingDots />
                        <span>Running code...</span>
                    </div>
                )}
            </div>
        );
    }
    
    const argEntries = args ? Object.entries(args) : [];
  
    return (
      <div className="min-w-0 flex-1 text-sm space-y-2">
        {argEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Input</p>
            <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-lg p-3 font-mono text-xs">
                {argEntries.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                    <span className="text-slate-400 dark:text-slate-500 select-none">{key}:</span>
                    <span className="text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap">{String(value)}</span>
                    </div>
                )
                )}
            </div>
          </div>
        )}
        
        <div>
            {result ? (
                <ToolResultDisplay result={result} sendMessage={sendMessage} onRegenerate={handleRegenerate} />
            ) : call.name === 'generateVideo' ? (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg text-sm">
                    <div className="flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 text-indigo-500 dark:text-indigo-400 animate-pulse mt-0.5"><path d="m11.25 8.122-2.122-1.59a.75.75 0 0 0-1.278.61v4.716a.75.75 0 0 0 1.278.61l2.122-1.59a.75.75 0 0 0 0-1.22Z" /><path fillRule="evenodd" d="M1.75 6.125a3.375 3.375 0 0 1 3.375-3.375h10.125a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H5.125a3.375 3.375 0 0 1-3.375-3.375V6.125Zm2.625.75c-.414 0-.75.336-.75.75v7.25c0 .414.336.75.75.75h10.125a.75.75 0 0 0 .75-.75V6.125a.75.75 0 0 0-.75-.75H4.375Z" clipRule="evenodd" /></svg>
                        <div>
                           <p className="font-semibold text-indigo-700 dark:text-indigo-300">Generating video...</p>
                           <p className="text-indigo-600/80 dark:text-indigo-400/80 mt-1">This can take a few minutes. Please wait.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <LoadingDots />
                    <span>Processing...</span>
                </div>
            )}
        </div>
      </div>
    );
};
