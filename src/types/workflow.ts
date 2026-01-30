
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageError } from './error';
import type { ToolCallEvent } from './message';

// Types moved from src/components/AI/WorkflowNode.tsx
export type WorkflowNodeStatus = 'pending' | 'active' | 'done' | 'failed';
export type WorkflowNodeType = 'plan' | 'task' | 'tool' | 'duckduckgoSearch' | 'thought' | 'act_marker' | 'observation' | 'handoff' | 'validation' | 'approval' | 'correction' | 'archival' | 'audit';

export type WorkflowNodeData = {
  id: string;
  type: WorkflowNodeType;
  title: string;
  status: WorkflowNodeStatus;
  details?: string | ToolCallEvent | MessageError;
  duration?: number | null;
  agentName?: string;
  handoff?: { from: string; to: string };
};

export type RenderSegment = {
    type: 'text' | 'component';
    content?: string;
    componentType?: 'VIDEO' | 'ONLINE_VIDEO' | 'IMAGE' | 'ONLINE_IMAGE' | 'MCQ' | 'MAP' | 'FILE' | 'BROWSER' | 'CODE_OUTPUT';
    data?: any;
};

export type ParsedWorkflow = {
  plan: string;
  executionLog: WorkflowNodeData[];
  finalAnswer: string;
  finalAnswerSegments: RenderSegment[];
};
