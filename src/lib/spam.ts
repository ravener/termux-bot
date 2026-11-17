import { Channels } from '#lib/constants';
import { sleep } from '@sapphire/utilities';
import { EmbedBuilder, PermissionFlagsBits, type Guild, type Message, type Snowflake } from 'discord.js';

const SOFTBAN_REASON = 'compromised account';

const MAX_GAP_MS = 5 * 1000;
const QUIET_DELETE_MS = 60 * 1000;
const CHANNEL_THRESHOLD = 4;

interface Entry {
    timestamp: number;
    channelId: Snowflake;
}

const streaks = new Map<Snowflake, Entry[]>();
const timedOut = new Map<Snowflake, number>();

setInterval(() => {
    const now = Date.now();
    for (const [key, streak] of streaks) {
        const last = streak.at(-1);
        if (!last || now - last.timestamp > MAX_GAP_MS) streaks.delete(key);
    }
    for (const [key, timestamp] of timedOut) {
        if (now - timestamp > QUIET_DELETE_MS) timedOut.delete(key);
    }
}, QUIET_DELETE_MS).unref();

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function record(key: Snowflake, message: Message<true>, now: number) {
    const previous = streaks.get(key) ?? [];
    const last = previous.at(-1);
    const continues = last !== undefined
        && now - last.timestamp <= MAX_GAP_MS
        && !previous.some((e) => e.channelId === message.channelId);

    const streak = continues ? previous : [];
    streak.push({ timestamp: now, channelId: message.channelId });
    streaks.set(key, streak);

    return streak.length >= CHANNEL_THRESHOLD ? streak : null;
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
    streaks.delete(key);
    await handleCluster(message, cluster);
    return true;
}
