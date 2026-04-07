import { promises as fs } from 'fs';
import path from 'path';

export async function generateAsciiTree(dirPath: string, prefix: string = ''): Promise<string> {
    let output = '';
    let entries;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
        return `${prefix} [Error reading directory]\n`;
    }
    entries = entries.filter(e => !e.name.startsWith('.'));
    entries.sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) {
            return a.name.localeCompare(b.name);
        }
        return a.isDirectory() ? -1 : 1;
    });
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        output += `${prefix}${connector}${entry.name}\n`;
        if (entry.isDirectory()) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            output += await generateAsciiTree(path.join(dirPath, entry.name), childPrefix);
        }
    }
    return output;
}

export async function generateDirectoryStructure(dirPath: string): Promise<any> {
    const name = path.basename(dirPath);
    let stats;
    try { stats = await fs.stat(dirPath); } catch { return null; }
    if (stats.isDirectory()) {
        let entries;
        try { entries = await fs.readdir(dirPath, { withFileTypes: true }); } catch { return null; }
        const children = [];
        entries.sort((a, b) => {
            if (a.isDirectory() === b.isDirectory()) { return a.name.localeCompare(b.name); }
            return a.isDirectory() ? -1 : 1;
        });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const childPath = path.join(dirPath, entry.name);
            const childNode = await generateDirectoryStructure(childPath);
            if (childNode) children.push(childNode);
        }
        return { name, type: 'directory', children };
    } else {
        return { name, type: 'file' };
    }
}
