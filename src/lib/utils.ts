import { sleep } from '@sapphire/utilities';

const suffixes = ['Bytes', 'KB', 'MB', 'GB'];

export function getBytes(bytes: number) {
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (!bytes && '0 Bytes') || `${(bytes / Math.pow(1024, i)).toFixed(2)} ${suffixes[i]}`;
}

export async function deleteWithRetry(action: () => Promise<unknown>) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await action();
            return;
        } catch {
            if (attempt < 3) await sleep(2000);
        }
    }
}
