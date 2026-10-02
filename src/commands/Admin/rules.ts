import { Args, Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, type Message } from 'discord.js';
import { Channels } from '#lib/constants';
import { codeBlock } from '@sapphire/utilities';

@ApplyOptions<Command.Options>({
    description: 'Displays or changes the server rules',
    runIn: ['GUILD_TEXT'],
    aliases: ['r', 'rule'],
    preconditions: ['NotGeneral', 'AdminOnly'],
    quotes: [] // disable quote parsing to allow quotes in the rules message
})
export class RulesCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        if (!message.inGuild()) return;

        const rulesChannel = message.guild.channels.cache.get(Channels.Rules);
        if (!rulesChannel || !rulesChannel.isTextBased()) {
            await message.reply('Rules channel not found.');
            return;
        }

        const lastMessage = await rulesChannel.messages.fetch({ limit: 1 }).then(messages => messages.first());

        if (args.finished) {
            if (!lastMessage || !lastMessage.embeds.length) {
                await message.reply('No rules message found.');
                return;
            }

            await message.reply(codeBlock('md', lastMessage.embeds[0]?.description ?? 'No rules found.'));
            return;
        }

        const rules = await args.rest('string');
        const embed = new EmbedBuilder()
            .setTitle('Server Rules')
            .setColor(0xFFFFFF)
            .setDescription(rules);

        if (lastMessage) {
            await lastMessage.edit({ embeds: [embed] });
        } else {
            await rulesChannel.send({ embeds: [embed] });
        }

        await message.reply('Rules updated successfully.');
    }
}
