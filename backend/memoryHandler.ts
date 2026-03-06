/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { MEMORY_CONTENT_PATH, MEMORY_FILES_DIR, readData, writeData, writeFileAtomic } from './data-store';

// Helper to generate human-readable filenames
// Format: {Sanitized-Title}-{ShortID}.tsx
const generateFilename = (title: string, id: string) => {
    const safeTitle = title
        .replace(/[^a-z0-9\-_ ]/gi, '_') // Replace invalid chars with underscore
        .trim()
        .replace(/\s+/g, '-')            // Replace spaces with dashes
        .substring(0, 50) || 'untitled'; // Limit length
    
    const shortId = id.substring(0, 6);
    return `${safeTitle}-${shortId}.tsx`;
};

const readMemory = async (): Promise<{ content: string, files: any[] }> => {
    try {
        // 1. Read Core Content (remains txt)
        let content = '';
        try {
            content = await fs.readFile(MEMORY_CONTENT_PATH, 'utf-8');
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
        }

        // 2. Read Files (now tsx)
        let files: any[] = [];
        try {
            const dirEntries = await fs.readdir(MEMORY_FILES_DIR);
            for (const filename of dirEntries) {
                if (filename.endsWith('.tsx')) {
                    const filePath = path.join(MEMORY_FILES_DIR, filename);
                    try {
                        const fileData = await readData(filePath);
                        files.push(fileData);
                    } catch (e) {
                        console.warn(`Skipping invalid memory file: ${filename}`);
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
        }

        return { content, files };

    } catch (error: any) {
        console.error('Failed to read memory:', error);
        return { content: '', files: [] };
    }
};

export const getMemory = async (req: any, res: any) => {
    try {
        const memory = await readMemory();
        res.status(200).json(memory);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve memory.' });
    }
};

export const updateMemory = async (req: any, res: any) => {
    try {
        const { content, files } = req.body;
        
        // Update Core Content if provided
        if (content !== undefined) {
            await writeFileAtomic(MEMORY_CONTENT_PATH, content);
        }

        // Update Files if provided (Full sync strategy)
        if (files !== undefined && Array.isArray(files)) {
            // 1. Map existing files on disk to their IDs to handle renames/deletions
            const existingEntries = await fs.readdir(MEMORY_FILES_DIR, { withFileTypes: true });
            const existingFileMap = new Map<string, string>(); // Map<ID, Filename>

            for (const entry of existingEntries) {
                if (entry.isFile() && entry.name.endsWith('.tsx')) {
                    try {
                        const filePath = path.join(MEMORY_FILES_DIR, entry.name);
                        const json = await readData<any>(filePath);
                        if (json.id) {
                            existingFileMap.set(json.id, entry.name);
                        }
                    } catch (e) {
                        // Ignore corrupt files
                    }
                }
            }

            const newIds = new Set(files.map((f: any) => f.id));

            // 2. Delete files that were removed in the UI
            for (const [id, filename] of existingFileMap) {
                if (!newIds.has(id)) {
                    await fs.unlink(path.join(MEMORY_FILES_DIR, filename));
                }
            }

            // 3. Write/Update new files with correct naming
            for (const file of files) {
                const newFilename = generateFilename(file.title, file.id);
                const oldFilename = existingFileMap.get(file.id);
                
                // If the file exists but the title changed (resulting in new filename), delete the old one
                if (oldFilename && oldFilename !== newFilename) {
                    try {
                        await fs.unlink(path.join(MEMORY_FILES_DIR, oldFilename));
                    } catch (e) {
                        // Ignore error if file was already gone
                    }
                }

                const filePath = path.join(MEMORY_FILES_DIR, newFilename);
                await writeData(filePath, file);
            }
        }
        
        // Return full updated state
        const updatedMemory = await readMemory();
        res.status(200).json(updatedMemory);

    } catch (error) {
        console.error('Failed to update memory:', error);
        res.status(500).json({ error: 'Failed to update memory.' });
    }
};

export const clearMemory = async (req: any, res: any) => {
    try {
        // Clear Content
        await writeFileAtomic(MEMORY_CONTENT_PATH, '');

        // Clear Files
        const files = await fs.readdir(MEMORY_FILES_DIR);
        for (const file of files) {
            await fs.unlink(path.join(MEMORY_FILES_DIR, file));
        }

        res.status(204).send();
    } catch (error) {
        console.error('Failed to clear memory:', error);
        res.status(500).json({ error: 'Failed to clear memory.' });
    }
};