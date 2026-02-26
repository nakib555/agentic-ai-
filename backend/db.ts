/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import path from 'path';
import { DATA_DIR } from './constants';

const dbPath = path.join(DATA_DIR, 'app.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// --- Initialize Schema ---

// Chat Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        model TEXT
    )
`).run();

// Message Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON string
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
    )
`).run();

// Settings Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL, -- JSON string
        updatedAt INTEGER NOT NULL
    )
`).run();

// Memory Table (Core Content)
db.prepare(`
    CREATE TABLE IF NOT EXISTS memory (
        key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
    )
`).run();

// Memory Files Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS memory_files (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON string
        updatedAt INTEGER NOT NULL
    )
`).run();

// Create Index for Messages
db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId)
`).run();

console.log(`[Database] Initialized at ${dbPath}`);

export default db;
