import { Channels } from '#lib/constants';
import { EmbedBuilder, PermissionFlagsBits, type Message, type Snowflake } from 'discord.js';

const MAX_GAP_MS = 5 * 1000;
const QUIET_DELETE_MS = 60 * 1000;
const CHANNEL_THRESHOLD = 4;
const TIMEOUT_MS = 60 * 60 * 1000;

interface Entry {
    timestamp: number;
    channelId: Snowflake;
    message: Message<true>;
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
    streak.push({ timestamp: now, channelId: message.channelId, message });
    streaks.set(key, streak);

    return streak.length >= CHANNEL_THRESHOLD ? streak : null;
}

async function handleCluster(message: Message<true>, cluster: Entry[]) {
    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return false;

    const timeoutError = await member
        .timeout(TIMEOUT_MS, 'Cross-channel spam')
        .then(() => null, errorMessage);

    const results = await Promise.all(
        cluster.map((e) => e.message.delete().then(() => true, () => false)),
    );
    const deleted = results.filter(Boolean).length;

    const modlogs = message.guild.channels.cache.get(Channels.Modlogs);
    if (!modlogs?.isSendable()) return true;

    const channelIds = [...new Set(cluster.map((e) => e.channelId))];
    const embed = new EmbedBuilder()
        .setTitle('Cross-channel spam detected')
        .setColor(0xED4245)
        .addFields(
            { name: 'User', value: `<@${message.author.id}> (${message.author.tag})` },
            { name: 'Channels', value: channelIds.map((id) => `<#${id}>`).join(', ') },
            { name: 'Messages matched', value: String(cluster.length), inline: true },
            { name: 'Messages deleted', value: `${deleted}/${cluster.length}`, inline: true },
            {
                name: 'Timeout',
                value: timeoutError === null ? `${TIMEOUT_MS / 60000}m` : `Failed: ${timeoutError}`,
                inline: true,
            },
            { name: 'Softban', value: `\`\`\`\n/softban user:${message.author.id} reason:compromised account\n\`\`\`` },
        )
        .setFooter({ text: `ID: ${message.author.id}` })
        .setTimestamp();

    await modlogs.send({ embeds: [embed] }).catch(() => null);
    return true;
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
    const moderated = await handleCluster(message, cluster);
    if (moderated) streaks.delete(key);
    else timedOut.delete(key);
    return moderated;
}
