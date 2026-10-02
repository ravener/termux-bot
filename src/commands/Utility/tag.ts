import { listAvailableTags } from '#lib/tags';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { AutocompleteInteraction, type ChatInputCommandInteraction, type Message } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Displays a tag',
    aliases: ['t', 'tags']
})
export class TagCommand extends Command {
    public override async messageRun(message: Message<true>, args: Args) {
        const tag = await args.pickResult('string');

        if (tag.isErr()) {
            await message.reply(`List of available tags:\n\n${listAvailableTags(this.container.tags)}`);
            return;
        }

        const content = this.getTag(tag.unwrap().toLowerCase());
        const messageReference = message.reference?.messageId ?? message.id;

        // Ping the user the author replied to if the message is a reply, otherwise ping the author of the command
        // Used when you intend the bot's response towards another person
        await message.channel.send({
            content,
            reply: { messageReference },
            allowedMentions: { repliedUser: true }
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const tag = interaction.options.getString('tag', true);
        const content = this.getTag(tag.toLowerCase());
        await interaction.reply(content);
    }

    private getTag(name: string) {
        const tag = this.container.tags.find(tag => tag.name === name || tag.aliases.includes(name));

        if (tag) {
            if (Array.isArray(tag.content)) {
                return tag.content.join('\n');
            }

            return tag.content;
        }

        return `Tag not found.\nList of available tags:\n\n${listAvailableTags(this.container.tags)}`;
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'tag') {
            const query = focusedOption.value.toLowerCase();

            const tags = this.container.tags
                .filter(tag =>
                    tag.name.toLowerCase().includes(query) ||
                    tag.aliases.some(alias => alias.toLowerCase().includes(query))
                )
                .slice(0, 25);

            await interaction.respond(
                tags.map(tag => ({
                    name: tag.name,
                    value: tag.name
                })),
            );
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) => builder
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option => option
                .setName('tag')
                .setDescription('The tag to view')
                .setRequired(true)
                .setAutocomplete(true)
            ));
    }
}
