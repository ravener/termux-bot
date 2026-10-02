import { readFile } from "node:fs/promises";
import { existsSync } from 'node:fs';

interface TimezoneEntry {
    user: string;
    timezone: string;
}

function formatTime(timeZone: string, date: Date = new Date()) {
    const time12 = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);

    const time24 = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);

    return `${time12} (${time24})`;
}

export const timezones = existsSync('data/timezones.json')
    ? JSON.parse(await readFile('data/timezones.json', 'utf-8')) as TimezoneEntry[]
    : [];

export function formatUserTimes(users: TimezoneEntry[]) {
    const now = new Date();

    return users
        .map(({ user, timezone }) => {
            return `- <@${user}> ${formatTime(timezone, now)}`;
        })
        .join('\n');
}

export function everyMinute(callback: () => Promise<void>) {
    const run = async () => {
        const now = new Date();
        const delay = 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds();

        setTimeout(run, delay);

        try {
            await callback();
        } catch (error) {
            console.error('everyMinute callback failed:', error);
        }
    };

    run();
}
