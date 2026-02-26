/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

/**
 * Writes content to a file atomically.
 * Works with Strings (text/json) and Buffers (binary/images).
 * Includes retry logic for robust handling of filesystem race conditions (ENOENT).
 */
export async function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    const dir = path.dirname(filePath);

    const performWrite = async () => {
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Write to temp file
        await fs.writeFile(tempPath, data);
        
        // Atomic rename (replace)
        await fs.rename(tempPath, filePath);
    };

    try {
        await performWrite();
    } catch (error: any) {
        // Attempt cleanup of temp file in case it was created but rename failed
        try { await fs.unlink(tempPath); } catch (e) {}

        // Retry logic for ENOENT or generic write errors that might be transient (e.g. folder deleted during write)
        if (error.code === 'ENOENT') {
            console.warn(`[FileUtils] Write failed with ENOENT, retrying once for: ${filePath}`);
            try {
                await performWrite();
                return;
            } catch (retryError: any) {
                // Cleanup again
                try { await fs.unlink(tempPath); } catch (e) {}
                
                throw new Error(`Write failed (Retry): Could not save '${path.basename(filePath)}'. The directory structure might be unstable. Original error: ${error.message}`);
            }
        }
        
        console.error(`[FileUtils] Failed to write file atomically to ${filePath}:`, error);
        throw error;
    }
}

/**
 * Wrapper for atomic JSON writing.
 */
export async function writeData(filePath: string, data: any): Promise<void> {
    await writeFileAtomic(filePath, JSON.stringify(data, null, 2));
}
