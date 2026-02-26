/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import db from './db';

const MEMORY_KEY = 'core';

const readMemory = async (): Promise<{ content: string, files: any[] }> => {
    try {
        // 1. Read Core Content
        const memoryRecord = db.prepare('SELECT content FROM memory WHERE key = ?').get(MEMORY_KEY) as any;
        const content = memoryRecord ? memoryRecord.content : '';

        // 2. Read Files
        const fileRecords = db.prepare('SELECT content FROM memory_files').all() as any[];
        const files = fileRecords.map(f => {
            try {
                return JSON.parse(f.content);
            } catch (e) {
                return null;
            }
        }).filter(f => f !== null);

        return { content, files };

    } catch (error: any) {
        console.error('Failed to read memory from DB:', error);
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
        
        const transaction = db.transaction(() => {
            // Update Core Content if provided
            if (content !== undefined) {
                db.prepare(`
                    INSERT INTO memory (key, content, updatedAt)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        content = excluded.content,
                        updatedAt = excluded.updatedAt
                `).run(MEMORY_KEY, content, Date.now());
            }

            // Update Files if provided (Full sync strategy)
            if (files !== undefined && Array.isArray(files)) {
                // Delete all files
                db.prepare('DELETE FROM memory_files').run();

                // Insert new files
                const insertFile = db.prepare(`
                    INSERT INTO memory_files (id, title, content, updatedAt)
                    VALUES (?, ?, ?, ?)
                `);

                for (const f of files) {
                    insertFile.run(
                        f.id,
                        f.title || 'Untitled',
                        JSON.stringify(f),
                        Date.now()
                    );
                }
            }
        });

        transaction();
        
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
        const transaction = db.transaction(() => {
            // Clear Content
            db.prepare(`
                INSERT INTO memory (key, content, updatedAt)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    content = excluded.content,
                    updatedAt = excluded.updatedAt
            `).run(MEMORY_KEY, '', Date.now());

            // Clear Files
            db.prepare('DELETE FROM memory_files').run();
        });

        transaction();

        res.status(204).send();
    } catch (error) {
        console.error('Failed to clear memory:', error);
        res.status(500).json({ error: 'Failed to clear memory.' });
    }
};
