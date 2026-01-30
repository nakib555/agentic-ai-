
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Message } from './message';

export type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
    model: string;
    isLoading?: boolean;
    createdAt: number;
    temperature?: number;
    maxOutputTokens?: number;
    imageModel?: string;
    videoModel?: string;
};
