
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageError, ToolCallEvent, WorkflowNodeData, WorkflowNodeType, ParsedWorkflow, RenderSegment } from '../types';

const GENERIC_STEP_KEYWORDS = new Set(['observe', 'adapt', 'system']);
const ACTION_KEYWORDS = new Set(['act', 'action', 'tool call']);

// Centralized list of supported UI components to ensure consistent regex generation
const SUPPORTED_COMPONENTS = [
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

/**
 * Parses raw text into component segments (e.g. text vs [IMAGE_COMPONENT]...[/...]).
 * This is used by the frontend to render components dynamically as text is typed.
 */
export const parseContentSegments = (text: string): RenderSegment[] => {
    if (!text) return [];

    // Regex to capture component tags and their content
    const tagsPattern = SUPPORTED_COMPONENTS.join('|');
    
    // Combined regex for [COMPONENT]...[/COMPONENT] AND <chart>...</chart> style tags
    // Matches:
    // 1. [TAG]{...}[/TAG]
    // 2. <d3>...</d3>
    // 3. <ploty>...</ploty>
    // 4. <hybird>...</hybird>
    const combinedRegex = new RegExp(
        `(\\[(?:${tagsPattern})\\][\\s\\S]*?\\[\\/(?:${tagsPattern})\\]|<(?:d3|ploty|hybird)>[\\s\\S]*?<\\/(?:d3|ploty|hybird)>)`, 
        'g'
    );

    const parts = text.split(combinedRegex).filter(part => part);

    return parts.map((part): RenderSegment | null => {
        // 1. Check for Standard JSON Components
        const componentMatch = part.match(new RegExp(`^\\[(${tagsPattern})\\]([\\s\\S]*?)\\[\\/\\1\\]$`));
        
        if (componentMatch) {
            const tagType = componentMatch[1];
            const contentString = componentMatch[2];

            try {
                // Map internal component tags to the RenderSegment types expected by the UI
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
                    'VEO_API_KEY_SELECTION_COMPONENT': 'VEO_API_KEY', // UI specific
                    'LOCATION_PERMISSION_REQUEST': 'LOCATION_PERMISSION', // UI specific
                    'ARTIFACT_CODE': 'ARTIFACT_CODE',
                    'ARTIFACT_DATA': 'ARTIFACT_DATA'
                };

                // Special handling for simple text-wrapped components vs JSON components
                if (['VEO_API_KEY_SELECTION_COMPONENT', 'LOCATION_PERMISSION_REQUEST'].includes(tagType)) {
                     return {
                        type: 'component',
                        componentType: typeMap[tagType] as any,
                        data: { text: contentString } // Pass string content directly
                    };
                }

                return {
                    type: 'component',
                    componentType: typeMap[tagType] as any,
                    data: JSON.parse(contentString)
                };
            } catch (e) {
                console.warn(`Failed to parse component data for ${tagType}`, e);
                // Fallback: treat as plain text if JSON parse fails to prevent crash
                return { type: 'text', content: part };
            }
        }
        
        // 2. Check for Chart Tags (<d3>, <ploty>, <hybird>)
        const chartMatch = part.match(/^<(d3|ploty|hybird)>([\s\S]*?)<\/\1>$/);
        if (chartMatch) {
            const rawTag = chartMatch[1]; // d3, ploty, or hybird
            const content = chartMatch[2].trim();
            
            // Map to internal engine names
            const engineMap: Record<string, string> = {
                'd3': 'd3',
                'ploty': 'plotly',
                'hybird': 'hybrid'
            };

            return {
                type: 'component',
                componentType: 'CHART',
                data: {
                    engine: engineMap[rawTag],
                    content: content
                }
            };
        }
        
        // Handle incomplete tags at the very end of the stream (during typing)
        const incompleteTagRegex = new RegExp(`(?:\\[(?:${tagsPattern})\\]|<(?:d3|ploty|hybird)>)$`);
        const cleanedPart = part.replace(incompleteTagRegex, '');
        
        // Preserve whitespace-only segments (like newlines) to maintain markdown structure
        if (cleanedPart.length === 0 && part.length > 0 && !part.match(incompleteTagRegex)) {
             return null;
        }
        
        if (cleanedPart.length === 0) return null;

        return { type: 'text', content: cleanedPart };
    }).filter((s): s is RenderSegment => s !== null);
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

  // 1. Check for Agentic Workflow Markers
  const briefingMatch = rawText.match(/\[BRIEFING\]([\s\S]*?)\[\/BRIEFING\]/);
  const planMarker = '[STEP] Strategic Plan:'; // Legacy Fallback
  const finalAnswerMarker = '[STEP] Final Answer:';
  const finalAnswerIndex = rawText.lastIndexOf(finalAnswerMarker);

  const hasSteps = rawText.includes('[STEP]') || !!briefingMatch;

  if (!hasSteps) {
      // Chat Mode: Everything is the final answer
      finalAnswerText = rawText;
  } else {
      // Agent Mode: Parse Steps
      let contentStartIndex = 0;

      // Extract Plan / Briefing
      if (briefingMatch) {
          planText = briefingMatch[1].trim();
          contentStartIndex = briefingMatch.index! + briefingMatch[0].length;
      } else {
          // Fallback parsing for legacy "Strategic Plan" steps
          const planMarkerIndex = rawText.indexOf(planMarker);
          if (planMarkerIndex !== -1) {
              const planStart = planMarkerIndex + planMarker.length;
              let planEnd = rawText.indexOf('[STEP]', planStart);
              if (planEnd === -1) planEnd = rawText.length;
              planText = rawText.substring(planStart, planEnd).trim();
              contentStartIndex = planEnd;
          }
      }

      // Extract Final Answer
      if (finalAnswerIndex !== -1) {
          finalAnswerText = rawText.substring(finalAnswerIndex + finalAnswerMarker.length);
          // Extract execution text (between plan and final answer)
          if (contentStartIndex < finalAnswerIndex) {
              executionText = rawText.substring(contentStartIndex, finalAnswerIndex);
          }
      } else {
          // No final answer yet, everything after plan is execution log
          executionText = rawText.substring(contentStartIndex);
      }
  }

  // Cleanup strings (Remove Agent tags from Plan/FinalAnswer so they look clean)
  planText = planText.replace(/\[AGENT:.*?\]\s*/g, '').replace(/\[USER_APPROVAL_REQUIRED\]/g, '').trim();
  finalAnswerText = finalAnswerText.replace(/^\s*:?\s*\[AGENT:\s*[^\]]+\]\s*/g, '').replace(/\[AUTO_CONTINUE\]/g, '').trim();

  // Parse Execution Log Steps
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

  // Merge Tool Events with Text Steps
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

  // Post-processing for status updates
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
