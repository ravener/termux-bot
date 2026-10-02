import { EmbedBuilder, type Message } from 'discord.js';
import { Channels } from './constants.js';

// TODO: This requires privileged message content intent.

const urlRegex = /https?:\/\/[^\s]+/i;
const codeBlockRegex = /```[\s\S]*?```/;

function isValidMessage(message: Message) {
    return codeBlockRegex.test(message.content)
        || urlRegex.test(message.content)
        || message.attachments.size > 0;
}

export async function handleShowcase(message: Message) {
    if (!message.inGuild()) return;
    if (message.channel.id !== Channels.Showcase) return;

    if (isValidMessage(message)) {
        if (!message.hasThread) {
            await message.startThread({ name: `${message.author.username}'s thread post` });
            return;
        }
    }

    await message.delete();
    const modlogs = message.client.channels.cache.get(Channels.Modlogs);
    if (!modlogs || !modlogs.isSendable()) {
        message.client.logger.warn(`Modlogs channel with ID ${Channels.Modlogs} not found.`);
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFAB87)
        .setTitle('Removed Invalid Showcase Message')
        .setDescription(`A message by ${message.author.tag} was removed from the showcase channel because it did not contain a code block, URL, or attachment.`)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .addFields({ name: 'Message Content', value: message.content || 'No content' })
        .setTimestamp();

    await modlogs.send({ embeds: [embed] });
}
