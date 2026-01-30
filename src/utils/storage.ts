/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { get, set, del } from 'idb-keyval';
import type { SavedFile } from '../components/Chat/MessageForm/types';

const DRAFT_TEXT_KEY = 'messageDraft_text';
const DRAFT_FILES_KEY = 'messageDraft_files';

export const storage = {
    // Text Drafts
    async saveTextDraft(text: string): Promise<void> {
        if (!text) {
            await del(DRAFT_TEXT_KEY);
        } else {
            await set(DRAFT_TEXT_KEY, text);
        }
    },

    async loadTextDraft(): Promise<string> {
        const text = await get<string>(DRAFT_TEXT_KEY);
        return text || '';
    },

    async clearTextDraft(): Promise<void> {
        await del(DRAFT_TEXT_KEY);
    },

    // File Drafts
    async saveFileDrafts(files: SavedFile[]): Promise<void> {
        if (files.length === 0) {
            await del(DRAFT_FILES_KEY);
        } else {
            await set(DRAFT_FILES_KEY, files);
        }
    },

    async loadFileDrafts(): Promise<SavedFile[]> {
        const files = await get<SavedFile[]>(DRAFT_FILES_KEY);
        return Array.isArray(files) ? files : [];
    },

    async clearFileDrafts(): Promise<void> {
        await del(DRAFT_FILES_KEY);
    },

    // Clear All
    async clearAllDrafts(): Promise<void> {
        await Promise.all([
            del(DRAFT_TEXT_KEY),
            del(DRAFT_FILES_KEY)
        ]);
    }
};