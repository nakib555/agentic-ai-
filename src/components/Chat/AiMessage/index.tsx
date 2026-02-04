
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, memo, useMemo, Suspense } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
const motion = motionTyped as any;
import type { Message, Source } from '../../../types';
import { MarkdownComponents } from '../../Markdown/markdownComponents';
import { ErrorDisplay } from '../../UI/ErrorDisplay';
import { ImageDisplay } from '../../AI/ImageDisplay';
import { VideoDisplay } from '../../AI/VideoDisplay';
import { ManualCodeRenderer } from '../../Markdown/ManualCodeRenderer';
import { TypingIndicator } from '../TypingIndicator';
import { McqComponent } from '../../AI/McqComponent';
import { MapDisplay } from '../../AI/MapDisplay';
import { FileAttachment } from '../../AI/FileAttachment';
import { SuggestedActions } from '../SuggestedActions';
import type { MessageFormHandle } from '../MessageForm/index';
import { useAiMessageLogic } from './useAiMessageLogic';
import { MessageToolbar } from './MessageToolbar';
import { BrowserSessionDisplay } from '../../AI/BrowserSessionDisplay';
import { useTypewriter } from '../../../hooks/useTypewriter';
import { parseContentSegments } from '../../../utils/workflowParsing';
import { CodeExecutionResult } from '../../AI/CodeExecutionResult';
import { UniversalChart } from '../../AI/UniversalChart';
import { fetchFromApi } from '../../../utils/api';

// Lazy load the heavy ArtifactRenderer
const ArtifactRenderer = React.lazy(() => import('../../Artifacts/ArtifactRenderer').then(m => ({ default: m.ArtifactRenderer })));

// Optimized spring physics for performance
const animationProps = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring", stiffness: 200, damping: 25 },
};

type AiMessageProps = { 
    msg: Message;
    isLoading: boolean;
    sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void; 
    ttsVoice: string; 
    ttsModel: string;
    currentChatId: string | null;
    activeModel: string;
    provider?: string;
    onShowSources: (sources: Source[]) => void;
    messageFormRef: React.RefObject<MessageFormHandle>;
    onRegenerate: (messageId: string) => void;
    onSetActiveResponseIndex: (messageId: string, index: number) => void;
    onNavigateBranch?: (messageId: string, direction: 'next' | 'prev') => void;
    userQuery?: string;
    isLast?: boolean;
    onEditMessage?: (messageId: string, newText: string) => void;
};

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
);

const ChartLoadingPlaceholder: React.FC<{ type: string }> = ({ type }) => {
    let label = 'Chart';
    if (type === 'd3') label = 'Visualization';
    else if (type === 'hybrid') label = 'Interactive Chart';
    else if (type === 'map') label = 'Map';

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="my-4 ml-1"
        >
            <span className="text-sm font-semibold shimmer-text tracking-wide">
                Generating {label}...
            </span>
        </motion.div>
    );
};

const AiMessageRaw: React.FC<AiMessageProps> = (props) => {
  const { msg, isLoading, sendMessage, ttsVoice, ttsModel, currentChatId, activeModel, provider,
          onShowSources, messageFormRef, onRegenerate,
          onNavigateBranch, isLast = false, onEditMessage, userQuery } = props;
  const { id } = msg;

  const logic = useAiMessageLogic(msg, ttsVoice, ttsModel, sendMessage, isLoading);
  const { activeResponse, finalAnswerText } = logic;
  
  const typedFinalAnswer = useTypewriter(finalAnswerText, msg.isThinking ?? false);
  
  // Handler for Fixing Code Snippets (Charts, etc)
  const handleFixCode = async (badCode: string, errorMsg?: string) => {
      if (!onEditMessage) return;
      
      try {
          // Call backend to fix using the currently selected model and provider
          const response = await fetchFromApi('/api/handler?task=fix_code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  code: badCode,
                  error: errorMsg,
                  context: userQuery, // Pass original query as context
                  model: activeModel || 'gemini-2.5-flash', // Use active model or fallback
                  provider: provider // Pass the active provider
              })
          });

          if (!response.ok) throw new Error("Fix request failed");
          
          const { fixedCode } = await response.json();
          
          if (fixedCode) {
              let cleanFixed = fixedCode.trim();

              // Remove markdown fences if present (backend might include them despite instructions)
              if (cleanFixed.startsWith('```')) {
                  cleanFixed = cleanFixed.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/\s*```$/, '').trim();
              }
              
              // Extract inner content from XML tags if present to prevent nested tagging
              const tagMatch = cleanFixed.match(/^<(\w+)>([\s\S]*?)<\/\1>$/i);
              const contentToInject = tagMatch ? tagMatch[2] : cleanFixed;

              const currentText = activeResponse?.text || '';
              
              // 1. Try exact match of inner content
              if (currentText.includes(badCode)) {
                  const newText = currentText.replace(badCode, contentToInject);
                  onEditMessage(id, newText);
                  return contentToInject;
              }
              
              // 2. Try match with relaxed whitespace/newlines
              // Escape badCode for regex, but allow whitespace differences
              const escapedBadCode = badCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
              const looseRegex = new RegExp(escapedBadCode, 'i');
              
              if (looseRegex.test(currentText)) {
                  const newText = currentText.replace(looseRegex, contentToInject);
                  onEditMessage(id, newText);
                  return contentToInject;
              }
              
              // 3. Fallback: Return fix for local component use even if we couldn't update history
              return contentToInject;
          }
      } catch (e) {
          console.error("Failed to fix code:", e);
      }
      return undefined;
  };

  const displaySegments = useMemo(() => {
      // Enhanced parsing to detect artifact tags
      const segments = parseContentSegments(typedFinalAnswer);
      
      const enhancedSegments = [];
      for (const segment of segments) {
          if (segment.type === 'text' && segment.content) {
              const artifactRegex = /(\[(?:ARTIFACT_CODE|ARTIFACT_DATA)\].*?\[\/(?:ARTIFACT_CODE|ARTIFACT_DATA)\])/s;
              const parts = segment.content.split(artifactRegex);
              
              for (const part of parts) {
                  if (!part.trim()) continue;
                  
                  const codeMatch = part.match(/^\[ARTIFACT_CODE\](\{.*?\})\[\/ARTIFACT_CODE\]$/s);
                  const dataMatch = part.match(/^\[ARTIFACT_DATA\](\{.*?\})\[\/ARTIFACT_DATA\]$/s);
                  
                  if (codeMatch) {
                      try {
                          const data = JSON.parse(codeMatch[1]);
                          enhancedSegments.push({ 
                              type: 'component', 
                              componentType: 'ARTIFACT_CODE', 
                              data 
                          });
                      } catch (e) { enhancedSegments.push({ type: 'text', content: part }); }
                  } else if (dataMatch) {
                      try {
                          const data = JSON.parse(dataMatch[1]);
                          enhancedSegments.push({ 
                              type: 'component', 
                              componentType: 'ARTIFACT_DATA', 
                              data 
                          });
                      } catch (e) { enhancedSegments.push({ type: 'text', content: part }); }
                  } else {
                      enhancedSegments.push({ type: 'text', content: part });
                  }
              }
          } else {
              enhancedSegments.push(segment);
          }
      }
      return enhancedSegments;

  }, [typedFinalAnswer]);

  const handleEditImage = (blob: Blob, editKey: string) => {
      const file = new File([blob], "image-to-edit.png", { type: blob.type });
      (file as any)._editKey = editKey;
      messageFormRef.current?.attachFiles([file]);
  };

  const isStoppedByUser = activeResponse?.error?.code === 'STOPPED_BY_USER';
  
  // Only show toolbar when generation AND typing effect are fully complete.
  // We use >= to be robust against potential length mismatches (e.g. carriage returns)
  const isTypingComplete = typedFinalAnswer.length >= (finalAnswerText?.length || 0);
  
  const shouldRenderContent = logic.hasFinalAnswer || activeResponse?.error || logic.isWaitingForFinalAnswer || isStoppedByUser || (!msg.isThinking && !finalAnswerText && logic.hasThinkingText);
  
  const showToolbar = logic.thinkingIsComplete && isTypingComplete && shouldRenderContent;

  if (logic.isInitialWait) return <TypingIndicator />;

  return (
    <motion.div 
        {...animationProps} 
        className="w-full flex flex-col items-start gap-3 origin-bottom-left group/message min-w-0"
    >
      {/* NEW: Render attachments on the message object if present */}
      {msg.attachments && msg.attachments.length > 0 && (
          <div className="w-full flex flex-col gap-2 mb-2">
              {msg.attachments.map((attachment, index) => (
                  <FileAttachment 
                      key={`msg-att-${index}`}
                      filename={attachment.name}
                      srcUrl={`data:${attachment.mimeType};base64,${attachment.data}`}
                      mimeType={attachment.mimeType}
                  />
              ))}
          </div>
      )}

      {shouldRenderContent && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full flex flex-col gap-3 min-w-0"
        >
          {logic.isWaitingForFinalAnswer && <TypingIndicator />}
          
          {/* Only show error if NOT stopped by user */}
          {activeResponse?.error && !isStoppedByUser && (
              <ErrorDisplay error={activeResponse.error} onRetry={() => onRegenerate(id)} />
          )}
          
          {/* Main Content Area */}
          <div className="markdown-content max-w-none w-full text-slate-800 dark:text-gray-100 leading-relaxed break-words min-w-0">
            {(!typedFinalAnswer && !msg.isThinking && !activeResponse?.error && logic.hasThinkingText) ? (
                 <div className="text-sm text-slate-500 italic p-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                    No final answer generated. Please check the reasoning logs.
                 </div>
            ) : (
                displaySegments.map((segment: any, index: number) => {
                    const key = `${id}-${index}`;
                    if (segment.type === 'component') {
                        const { componentType, data } = segment;
                        switch (componentType) {
                            case 'VIDEO': return <VideoDisplay key={key} {...data} />;
                            case 'ONLINE_VIDEO': return <VideoDisplay key={key} srcUrl={data.url} prompt={data.title} />;
                            case 'IMAGE':
                            case 'ONLINE_IMAGE': return <ImageDisplay key={key} onEdit={handleEditImage} {...data} />;
                            case 'MCQ': return <McqComponent key={key} {...data} />;
                            case 'MAP': return <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><MapDisplay {...data} /></motion.div>;
                            case 'FILE': return <FileAttachment key={key} {...data} />;
                            case 'BROWSER': return <BrowserSessionDisplay key={key} {...data} />;
                            case 'CODE_OUTPUT': return <CodeExecutionResult key={key} {...data} />;
                            case 'CHART': return <UniversalChart key={key} engine={data.engine} code={data.content} onFixCode={handleFixCode} isStreaming={msg.isThinking} />;
                            case 'LOADING_CHART': return <ChartLoadingPlaceholder key={key} type={data.type} />;
                            case 'ARTIFACT_CODE': return (
                                <Suspense fallback={<div className="h-64 w-full bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse my-4" />}>
                                    <ArtifactRenderer key={key} type="code" content={data.code} language={data.language} title={data.title} />
                                </Suspense>
                            );
                            case 'ARTIFACT_DATA': return (
                                <Suspense fallback={<div className="h-64 w-full bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse my-4" />}>
                                    <ArtifactRenderer key={key} type="data" content={data.content} title={data.title} />
                                </Suspense>
                            );
                            default: return <ErrorDisplay key={key} error={{ message: `Unknown component: ${componentType}`, details: JSON.stringify(data) }} />;
                        }
                    } else {
                        return (
                            <ManualCodeRenderer 
                                key={key} 
                                text={segment.content!} 
                                components={MarkdownComponents} 
                                isStreaming={msg.isThinking ?? false} 
                                onFixCode={handleFixCode}
                            />
                        );
                    }
                })
            )}
          </div>

          {/* Stopped Indicator - Rendered below content */}
          {isStoppedByUser && (
              <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg w-fit"
              >
                  <div className="text-amber-500 dark:text-amber-400">
                      <StopIcon />
                  </div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Generation Stopped</span>
              </motion.div>
          )}
        </motion.div>
      )}
      
      {/* Show toolbar if thinking is complete AND we have something to show (text, error, or stopped state) */}
      {showToolbar && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mt-2"
          >
            <MessageToolbar
                chatId={currentChatId}
                messageId={id}
                messageText={logic.finalAnswerText}
                rawText={activeResponse?.text || ''}
                sources={logic.searchSources}
                onShowSources={onShowSources}
                ttsState={logic.audioState}
                ttsErrorMessage={logic.ttsError}
                onTtsClick={logic.playOrStopAudio}
                onRegenerate={() => onRegenerate(id)}
                responseCount={msg.responses?.length || 0}
                activeResponseIndex={msg.activeResponseIndex}
                onNavigateBranch={onNavigateBranch}
            />
          </motion.div>
      )}

      {/* Conditionally render suggestions only if this is the last message */}
      <AnimatePresence>
        {isLast && logic.thinkingIsComplete && isTypingComplete && activeResponse?.suggestedActions && activeResponse.suggestedActions.length > 0 && !activeResponse.error && (
            <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full overflow-hidden"
            >
                <SuggestedActions actions={activeResponse.suggestedActions} onActionClick={sendMessage} />
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const AiMessage = memo(AiMessageRaw);
