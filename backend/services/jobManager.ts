export interface Job {
    chatId: string;
    messageId: string;
    controller: AbortController;
    clients: Set<any>; 
    eventBuffer: string[]; 
    persistence: any; // Will type this properly later
    createdAt: number;
}

const activeJobs = new Map<string, Job>();

export const jobManager = {
    get: (chatId: string) => activeJobs.get(chatId),
    set: (chatId: string, job: Job) => activeJobs.set(chatId, job),
    delete: (chatId: string) => activeJobs.delete(chatId),
    has: (chatId: string) => activeJobs.has(chatId),
    
    writeToClient: (job: Job, type: string, payload: any) => {
        const data = JSON.stringify({ type, payload }) + '\n';
        job.eventBuffer.push(data);
        job.clients.forEach(client => {
            if (!client.writableEnded && !client.closed && !client.destroyed) {
                try {
                    client.write(data);
                } catch (e) {
                    console.error(`[JOB] Failed to write to client for chat ${job.chatId}`, e);
                    job.clients.delete(client);
                }
            } else {
                 job.clients.delete(client);
            }
        });
    },

    cleanup: (chatId: string) => {
        const job = activeJobs.get(chatId);
        if (job) {
            job.clients.forEach(c => {
                if (!c.writableEnded) c.end();
            });
            activeJobs.delete(chatId);
        }
    }
};
