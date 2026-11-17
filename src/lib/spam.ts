import { Channels } from '#lib/constants';
import { sleep } from '@sapphire/utilities';
import { EmbedBuilder, PermissionFlagsBits, type Guild, type Message, type Snowflake } from 'discord.js';
import { distance } from 'fastest-levenshtein';

const SOFTBAN_REASON = 'compromised account';

const MAX_GAP_MS = 5 * 1000;
const QUIET_DELETE_MS = 60 * 1000;
const CHANNEL_THRESHOLD = 4;
const DUPLICATE_WINDOW_MS = 60 * 1000;

interface Entry {
    timestamp: number;
    channelId: Snowflake;
    text: string;
}

const history = new Map<Snowflake, Entry[]>();
const timedOut = new Map<Snowflake, number>();

setInterval(() => {
    const now = Date.now();
    for (const [key, entries] of history) {
        if (now - entries.at(-1)!.timestamp > DUPLICATE_WINDOW_MS) history.delete(key);
    }
    for (const [key, timestamp] of timedOut) {
        if (now - timestamp > QUIET_DELETE_MS) timedOut.delete(key);
    }
}, QUIET_DELETE_MS).unref();

const similarity = (a: string, b: string) => 1 - distance(a, b) / Math.max(a.length, b.length, 1);
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function record(key: Snowflake, message: Message<true>, now: number) {
    const entry: Entry = {
        timestamp: now,
        channelId: message.channelId,
        text: normalize(message.content).slice(0, 100),
    };
    const recent = (history.get(key) ?? []).filter((e) => now - e.timestamp <= DUPLICATE_WINDOW_MS);
    recent.push(entry);
    history.set(key, recent.slice(-10));

    const similar = entry.text.length < 4 ? [] : recent.filter((e) => similarity(e.text, entry.text) >= 0.85);
    if (new Set(similar.map((e) => e.channelId)).size >= 3) return similar;

    const burst = [entry];
    for (let i = recent.length - 2; i >= 0; i--) {
        const e = recent[i]!;
        if (burst.at(-1)!.timestamp - e.timestamp > MAX_GAP_MS || burst.some((b) => b.channelId === e.channelId)) break;
        burst.push(e);
    }
    return burst.length >= CHANNEL_THRESHOLD ? burst : null;
}

async function softban(guild: Guild, userId: Snowflake) {
    for (let attempt = 1; ; attempt++) {
        try {
            await guild.members.ban(userId, { reason: SOFTBAN_REASON, deleteMessageSeconds: 10 * 60 });
            await guild.members.unban(userId, SOFTBAN_REASON);
            return;
        } catch (error) {
            if (attempt >= 3) throw error;
            await sleep(2000);
        }
    }
}

async function handleCluster(message: Message<true>, cluster: Entry[]) {
    const softbanError = await softban(message.guild, message.author.id).then(() => null, errorMessage);

    const modlogs = message.guild.channels.cache.get(Channels.Modlogs);
    if (!modlogs?.isSendable()) return;

    const channelIds = [...new Set(cluster.map((e) => e.channelId))];
    const embed = new EmbedBuilder()
        .setTitle('Cross-channel spam detected')
        .setColor(0xED4245)
        .addFields(
            { name: 'User', value: `<@${message.author.id}> (${message.author.tag})` },
            { name: 'Channels', value: channelIds.map((id) => `<#${id}>`).join(', ') },
            { name: 'Messages matched', value: String(cluster.length), inline: true },
            { name: 'Softban', value: softbanError === null ? 'Applied' : `Failed: ${softbanError}`, inline: true },
        )
        .setFooter({ text: `ID: ${message.author.id}` })
        .setTimestamp();

    await modlogs.send({ embeds: [embed] }).catch(() => null);
}

export async function checkSpam(message: Message<true>) {
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

    const key = message.author.id;
    const now = Date.now();

    const markedAt = timedOut.get(key);
    if (markedAt !== undefined && now - markedAt <= QUIET_DELETE_MS) {
        await message.delete().catch(() => null);
        return true;
    }

    const cluster = record(key, message, now);
    if (!cluster) return false;

    timedOut.set(key, now);
    history.delete(key);
    await handleCluster(message, cluster);
    return true;
}
