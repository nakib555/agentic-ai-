
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageError, ToolCallEvent, WorkflowNodeData, WorkflowNodeType, ParsedWorkflow, RenderSegment } from '../types';

const GENERIC_STEP_KEYWORDS = new Set(['observe', 'adapt', 'system']);
const ACTION_KEYWORDS = new Set(['act', 'action', 'tool call']);

// Centralized list of supported UI components to ensure consistent regex generation
const SQUARE_COMPONENT_TAGS = [
    'VIDEO_COMPONENT', 
    'ONLINE_VIDEO_COMPONENT', 
    'IMAGE_COMPONENT', 
    'ONLINE_IMAGE_COMPONENT', 
    'MCQ_COMPONENT', 
    'MAP_COMPONENT', 
    'FILE_ATTACHMENT_COMPONENT', 
    'BROWSER_COMPONENT', 
    'CODE_OUTPUT_COMPONENT',
    'VEO_API_KEY_SELECTION_COMPONENT',
    'LOCATION_PERMISSION_REQUEST',
    'ARTIFACT_CODE',
    'ARTIFACT_DATA'
];

const XML_COMPONENT_TAGS = [
    'echarts',
    'map',
    'chart'
];

/**
 * Parses raw text into component segments (e.g. text vs [IMAGE_COMPONENT]...[/...] vs <echarts>...</echarts>).
 * This is used by the frontend to render components dynamically as text is typed.
 */
export const parseContentSegments = (text: string): RenderSegment[] => {
    if (!text) return [];

    const squarePattern = SQUARE_COMPONENT_TAGS.join('|');
    const xmlPattern = XML_COMPONENT_TAGS.join('|');
    
    // Regex to capture COMPLETE component tags and their content
    // Group 1: Square Brackets -> \[(TAGS)\][\s\S]*?\[\/\1\]
    // Group 2: XML Tags -> <(TAGS)>[\s\S]*?<\/\2>
    const completeComponentRegex = new RegExp(`(\\[(?:${squarePattern})\\][\\s\\S]*?\\[\\/(?:${squarePattern})\\])|(<(?:${xmlPattern})>[\\s\\S]*?<\\/(?:${xmlPattern})>)`, 'gi');
    
    const segments: RenderSegment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = completeComponentRegex.exec(text)) !== null) {
        // Strict Markdown check: If <echarts> or <map> is inside a code block, treat as text.
        // Group 2 captures the XML tag match.
        if (match[2]) {
             const textUpToMatch = text.substring(0, match.index);
             // Count occurrences of triple backticks to determine if we are inside a code block
             const backtickCount = (textUpToMatch.match(/```/g) || []).length;
             if (backtickCount % 2 !== 0) {
                 continue; // Skip this match, treat as text. The loop continues to find the next match.
             }
        }

        // 1. Handle Text Before Match
        let textPart = text.substring(lastIndex, match.index);
        
        // --- CLEANUP: Handle Markdown Code Blocks Wrapping Components ---
        // Models often wrap components like <echarts> in ```xml ... ``` blocks despite instructions.
        // We detect this pattern and strip the fences so the component renders visually.
        const openingFenceRegex = /```\w*\s*$/;
        const closingFenceRegex = /^\s*```/;
        
        if (openingFenceRegex.test(textPart)) {
             // Check if the text immediately after the component is a closing fence
             const textAfter = text.substring(completeComponentRegex.lastIndex);
             if (closingFenceRegex.test(textAfter)) {
                 // Strip opening fence from the preceding text
                 textPart = textPart.replace(openingFenceRegex, '');
                 
                 // Skip closing fence by advancing the regex index
                 const closingMatch = textAfter.match(closingFenceRegex);
                 if (closingMatch) {
                     completeComponentRegex.lastIndex += closingMatch[0].length;
                 }
             }
        }

        if (textPart) segments.push({ type: 'text', content: textPart });

        // 2. Handle the Complete Component Match
        const componentString = match[0];
        
        if (componentString.startsWith('[')) {
            // Square Bracket Component
            const squareMatch = componentString.match(new RegExp(`^\\[(${squarePattern})\\]([\\s\\S]*?)\\[\\/\\1\\]$`, 'i'));
            
            if (squareMatch) {
                const tagType = squareMatch[1].toUpperCase();
                const contentString = squareMatch[2];
                segments.push(parseSquareComponent(tagType, contentString, componentString));
            } else {
                segments.push({ type: 'text', content: componentString });
            }
        } else if (componentString.startsWith('<')) {
            // XML Component
            const xmlMatch = componentString.match(new RegExp(`^<(${xmlPattern})>([\\s\\S]*?)<\\/\\1>$`, 'i'));
            
            if (xmlMatch) {
                const tagType = xmlMatch[1].toLowerCase();
                const contentString = xmlMatch[2];
                
                if (tagType === 'map') {
                     try {
                        const json = JSON.parse(contentString);
                        segments.push({
                            type: 'component',
                            componentType: 'MAP',
                            data: json
                        });
                     } catch(e) {
                         // Fallback for bad JSON inside map
                         segments.push({ type: 'text', content: componentString });
                     }
                } else {
                    // Default to Chart/ECharts (handles both <echarts> and <chart>)
                    segments.push({
                        type: 'component',
                        componentType: 'CHART',
                        data: {
                            engine: tagType === 'echarts' ? 'echarts' : 'generic', // generic will be inspected by UniversalChart for engine type
                            content: contentString
                        }
                    });
                }
            } else {
                segments.push({ type: 'text', content: componentString });
            }
        }

        lastIndex = completeComponentRegex.lastIndex;
    }

    // 3. Handle Remaining Text (Streaming Partial Detection)
    if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        
        // Check for an OPENING tag that hasn't been closed
        const openTagRegex = new RegExp(`(<(${xmlPattern})>)`, 'i');
        const openTagMatch = remainingText.match(openTagRegex);
        
        if (openTagMatch) {
            // Check context for partial tag to prevent partials inside code blocks showing as loading
            const absoluteIndex = lastIndex + openTagMatch.index!;
            const textUpToOpen = text.substring(0, absoluteIndex);
            const backtickCount = (textUpToOpen.match(/```/g) || []).length;
            
            if (backtickCount % 2 !== 0) {
                 // Inside code block. Ignore component detection.
                 segments.push({ type: 'text', content: remainingText });
            } else {
                const textBefore = remainingText.substring(0, openTagMatch.index);
                const tagType = openTagMatch[2].toLowerCase();
                
                if (textBefore) {
                     segments.push({ type: 'text', content: textBefore });
                }
                
                // Push the special loading placeholder
                segments.push({
                    type: 'component',
                    componentType: 'LOADING_CHART',
                    data: { type: tagType }
                });
            }
        } else {
             let cleanedPart = remainingText;

             // 1. Partial XML Tag at end: matches < followed by potential tag characters
             const partialXmlRegex = /(<[a-z0-9\._-]*)$/i;
             
             // 2. Partial Square Tag at end: matches [ followed by potential tag characters
             const partialSquareRegex = /(\[[a-z0-9_]*)$/i;

             cleanedPart = cleanedPart.replace(partialXmlRegex, '');
             cleanedPart = cleanedPart.replace(partialSquareRegex, '');
             
             if (cleanedPart) {
                segments.push({ type: 'text', content: cleanedPart });
             }
        }
    }

    return segments;
};

const parseSquareComponent = (tagType: string, contentString: string, originalPart: string): RenderSegment => {
    try {
        const typeMap: Record<string, string> = {
            'VIDEO_COMPONENT': 'VIDEO',
            'ONLINE_VIDEO_COMPONENT': 'ONLINE_VIDEO',
            'IMAGE_COMPONENT': 'IMAGE',
            'ONLINE_IMAGE_COMPONENT': 'ONLINE_IMAGE',
            'MCQ_COMPONENT': 'MCQ',
            'MAP_COMPONENT': 'MAP',
            'FILE_ATTACHMENT_COMPONENT': 'FILE',
            'BROWSER_COMPONENT': 'BROWSER',
            'CODE_OUTPUT_COMPONENT': 'CODE_OUTPUT',
            'VEO_API_KEY_SELECTION_COMPONENT': 'VEO_API_KEY',
            'LOCATION_PERMISSION_REQUEST': 'LOCATION_PERMISSION',
            'ARTIFACT_CODE': 'ARTIFACT_CODE',
            'ARTIFACT_DATA': 'ARTIFACT_DATA'
        };

        if (['VEO_API_KEY_SELECTION_COMPONENT', 'LOCATION_PERMISSION_REQUEST'].includes(tagType)) {
             return {
                type: 'component',
                componentType: typeMap[tagType] as any,
                data: { text: contentString }
            };
        }

        return {
            type: 'component',
            componentType: typeMap[tagType] as any,
            data: JSON.parse(contentString)
        };
    } catch (e) {
        console.warn(`Failed to parse component data for ${tagType}`, e);
        return { type: 'text', content: originalPart };
    }
};

export const parseAgenticWorkflow = (
  rawText: string,
  toolCallEvents: ToolCallEvent[] = [],
  isThinkingComplete: boolean,
  error?: MessageError
): ParsedWorkflow => {
  let planText = '';
  let executionText = '';
  let finalAnswerText = '';

  const briefingMatch = rawText.match(/\[BRIEFING\]([\s\S]*?)\[\/BRIEFING\]/);
  const planMarker = '[STEP] Strategic Plan:';
  const finalAnswerMarker = '[STEP] Final Answer:';
  const finalAnswerIndex = rawText.lastIndexOf(finalAnswerMarker);

  const hasSteps = rawText.includes('[STEP]') || !!briefingMatch;

  if (!hasSteps) {
      finalAnswerText = rawText;
  } else {
      let contentStartIndex = 0;

      if (briefingMatch) {
          planText = briefingMatch[1].trim();
          contentStartIndex = briefingMatch.index! + briefingMatch[0].length;
      } else {
          const planMarkerIndex = rawText.indexOf(planMarker);
          if (planMarkerIndex !== -1) {
              const planStart = planMarkerIndex + planMarker.length;
              let planEnd = rawText.indexOf('[STEP]', planStart);
              if (planEnd === -1) planEnd = rawText.length;
              planText = rawText.substring(planStart, planEnd).trim();
              contentStartIndex = planEnd;
          }
      }

      if (finalAnswerIndex !== -1) {
          finalAnswerText = rawText.substring(finalAnswerIndex + finalAnswerMarker.length);
          if (contentStartIndex < finalAnswerIndex) {
              executionText = rawText.substring(contentStartIndex, finalAnswerIndex);
          }
      } else {
          executionText = rawText.substring(contentStartIndex);
      }
  }

  planText = planText.replace(/\[AGENT:.*?\]\s*/g, '').replace(/\[USER_APPROVAL_REQUIRED\]/g, '').trim();
  finalAnswerText = finalAnswerText.replace(/^\s*:?\s*\[AGENT:\s*[^\]]+\]\s*/g, '').replace(/\[AUTO_CONTINUE\]/g, '').trim();

  const textNodes: WorkflowNodeData[] = [];
  const stepRegex = /(?:^|\n)\[STEP\]\s*(.*?):\s*([\s\S]*?)(?=(?:^|\n)\[STEP\]|$)/g;
  
  let match;
  let stepIndex = 0;
  let currentContextAgent = 'System'; 

  while ((match = stepRegex.exec(executionText)) !== null) {
    let title = match[1].trim().replace(/:$/, '').trim();
    let details = match[2].trim().replace(/\[AUTO_CONTINUE\]/g, '').trim();
    const lowerCaseTitle = title.toLowerCase();

    if (lowerCaseTitle === 'final answer' || lowerCaseTitle === 'strategic plan') continue;

    let type: WorkflowNodeType = 'plan';
    let agentName: string | undefined;
    let handoff: { from: string; to: string } | undefined;

    const agentMatch = details.match(/^\[AGENT:\s*([^\]]+)\]\s*/);
    if (agentMatch) {
        agentName = agentMatch[1].trim();
        currentContextAgent = agentName;
        details = details.replace(agentMatch[0], '').trim();
    } else {
        agentName = currentContextAgent;
    }

    const handoffMatch = title.match(/^Handoff:\s*(.*?)\s*->\s*(.*)/i);
    if (handoffMatch) {
        type = 'handoff';
        handoff = { from: handoffMatch[1].trim(), to: handoffMatch[2].trim() };
        currentContextAgent = handoff.to;
    } else if (lowerCaseTitle.startsWith('validate')) {
        type = 'validation';
    } else if (lowerCaseTitle.startsWith('corrective action')) {
        type = 'correction';
    } else if (lowerCaseTitle === 'think' || lowerCaseTitle === 'adapt') {
        type = 'thought';
        details = details || title;
        title = 'Reasoning';
    } else if (lowerCaseTitle === 'observe') {
        type = 'observation';
        title = 'Observation';
    } else if (ACTION_KEYWORDS.has(lowerCaseTitle)) {
        type = 'act_marker';
    }

    if (title.length > 50) title = title.substring(0, 50) + '...';

    textNodes.push({
        id: `step-${stepIndex++}`,
        type: type,
        title: title,
        status: 'pending',
        details: details || 'No details provided.',
        agentName: agentName,
        handoff: handoff,
    });
  }

  const toolNodesQueue = toolCallEvents.map(event => {
    const isDuckDuckGoSearch = event.call.name === 'duckduckgoSearch';
    const duration = event.startTime && event.endTime ? (event.endTime - event.startTime) / 1000 : null;
    const isError = event.result?.startsWith('Tool execution failed');
    const nodeStatus = event.result ? (isError ? 'failed' : 'done') : 'active';

    return {
        id: event.id,
        type: isDuckDuckGoSearch ? 'duckduckgoSearch' : 'tool',
        title: isDuckDuckGoSearch ? ((event.call.args as any).query ?? 'Searching...') : event.call.name,
        status: nodeStatus,
        details: event,
        duration: duration,
        agentName: currentContextAgent 
    } as WorkflowNodeData;
  });

  const executionLog: WorkflowNodeData[] = [];
  
  for (const textNode of textNodes) {
    if (textNode.type === 'act_marker') {
        if (toolNodesQueue.length > 0) {
            const toolNode = toolNodesQueue.shift();
            if (toolNode) {
                toolNode.agentName = textNode.agentName || currentContextAgent;
                executionLog.push(toolNode);
            }
        }
        if (textNode.details && textNode.details !== 'No details provided.') {
             executionLog.push(textNode);
        }
    } else {
        executionLog.push(textNode);
    }
  }
  
  for (const toolNode of toolNodesQueue) {
      executionLog.push(toolNode);
  }

  if (error) {
    let failureAssigned = false;
    for (let i = executionLog.length - 1; i >= 0; i--) {
        const node = executionLog[i];
        if (node.status === 'active' || node.status === 'pending') {
            node.status = 'failed';
            node.details = error;
            failureAssigned = true;
            break;
        }
    }
    if (!failureAssigned && executionLog.length > 0) {
        executionLog[executionLog.length - 1].status = 'failed';
        executionLog[executionLog.length - 1].details = error;
    }
    
    let failurePointReached = false;
    executionLog.forEach(node => {
        if (node.status === 'failed') failurePointReached = true;
        if (node.status !== 'failed' && !failurePointReached) node.status = 'done';
    });

  } else if (isThinkingComplete) {
    executionLog.forEach(node => {
      if (node.status !== 'failed') node.status = 'done';
    });
  } else {
    let lastActiveNodeFound = false;
    for (let i = executionLog.length - 1; i >= 0; i--) {
        const node = executionLog[i];
        if (!lastActiveNodeFound && node.status !== 'done') {
            node.status = 'active';
            lastActiveNodeFound = true;
        } else if (node.status === 'active') {
            node.status = 'done'; 
        }
    }
  }
  
  const finalAnswerSegments = parseContentSegments(finalAnswerText);

  return { plan: planText, executionLog, finalAnswer: finalAnswerText, finalAnswerSegments };
};
