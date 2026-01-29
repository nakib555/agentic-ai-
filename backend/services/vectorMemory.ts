/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { promises as fs } from 'fs';
import path from 'path';
import { DATA_DIR, writeData } from '../data-store';

const VECTOR_STORE_PATH = path.join(DATA_DIR, 'vector_store.json');

type VectorEntry = {
    id: string;
    text: string;
    vector: number[];
    metadata: any;
    timestamp: number;
};

// Simple cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorMemory {
    private store: VectorEntry[] = [];
    private ai: GoogleGenAI | null = null;
    private initialized = false;

    constructor() {}

    async init(ai: GoogleGenAI) {
        this.ai = ai;
        try {
            const data = await fs.readFile(VECTOR_STORE_PATH, 'utf-8');
            this.store = JSON.parse(data);
        } catch (e) {
            this.store = [];
            // Create file if not exists
            await this.save();
        }
        this.initialized = true;
    }

    private async save() {
        await writeData(VECTOR_STORE_PATH, this.store);
    }

    private async getEmbedding(text: string): Promise<number[]> {
        if (!this.ai) throw new Error("VectorMemory not initialized with AI client");
        
        try {
            const result = await this.ai.models.embedContent({
                model: "text-embedding-004",
                contents: [{ parts: [{ text }] }]
            });
            // Fix for TS2551: Handle potential API type mismatch (embedding vs embeddings)
            const response = result as any;
            const embedding = response.embedding || (response.embeddings && response.embeddings[0]);
            return embedding?.values || [];
        } catch (e) {
            console.error("Embedding failed:", e);
            return [];
        }
    }

    async addMemory(text: string, metadata: any = {}) {
        if (!text || !this.ai) return;
        
        // Chunking optimization: split huge texts
        if (text.length > 1000) {
            const chunks = text.match(/.{1,1000}/g) || [];
            for (const chunk of chunks) {
                await this.addMemory(chunk, metadata);
            }
            return;
        }

        const vector = await this.getEmbedding(text);
        if (vector.length === 0) return;

        const entry: VectorEntry = {
            id: Math.random().toString(36).substring(7),
            text,
            vector,
            metadata,
            timestamp: Date.now()
        };

        this.store.push(entry);
        await this.save();
        console.log(`[VectorMemory] Added memory: "${text.substring(0, 50)}..."`);
    }

    async retrieveRelevant(query: string, limit = 3, threshold = 0.6): Promise<string[]> {
        if (!this.ai || this.store.length === 0) return [];

        const queryVector = await this.getEmbedding(query);
        if (queryVector.length === 0) return [];

        const scored = this.store.map(entry => ({
            ...entry,
            score: cosineSimilarity(queryVector, entry.vector)
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored
            .filter(entry => entry.score > threshold)
            .slice(0, limit)
            .map(entry => entry.text);
    }
}

export const vectorMemory = new VectorMemory();