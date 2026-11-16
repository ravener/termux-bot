import { listAvailableTags } from '#lib/tags';
import { deleteWithRetry } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { chunk, sleep } from '@sapphire/utilities';
import {
    ApplicationCommandType,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SectionBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    type ChatInputCommandInteraction,
    type Message,
    type MessageContextMenuCommandInteraction
} from 'discord.js';
import { reply, send } from '@sapphire/plugin-editable-commands';

@ApplyOptions<Command.Options>({
    description: 'Displays a tag',
    aliases: ['t', 'tags']
})
export class TagCommand extends Command {
    public override async messageRun(message: Message<true>, args: Args) {
        const tag = await args.pickResult('string');

        if (tag.isErr()) {
            await reply(message, `List of available tags:\n\n${listAvailableTags(this.container.tags)}`);
            return;
        }

        const content = this.getTag(tag.unwrap().toLowerCase());
        const messageReference = message.reference?.messageId ?? message.id;

        // Ping the user the author replied to if the message is a reply, otherwise ping the author of the command
        // Used when you intend the bot's response towards another person
        await send(message, {
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

    public override async contextMenuRun(interaction: MessageContextMenuCommandInteraction) {
        const pages = chunk(this.container.tags, 25).slice(0, 5);
        const modalId = `tag-select:${interaction.id}`;

        await interaction.showModal(new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Reply with tag')
            .addLabelComponents(pages.map((tags, i) => new LabelBuilder()
                .setLabel(`Tags ${i * 25 + 1}-${i * 25 + tags.length}`)
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(`tags-${i}`)
                    .setRequired(false)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .addOptions(tags.map(tag => ({
                        label: tag.name,
                        value: tag.name,
                        ...(tag.aliases.length ? { description: tag.aliases.join(', ') } : {})
                    })))))));

        const submit = await interaction
            .awaitModalSubmit({
                time: 2 * 60 * 1000,
                filter: (i) => i.customId === modalId && i.user.id === interaction.user.id
            })
            .catch(() => null);
        if (!submit) return;

        const names = pages.flatMap((_, i) => submit.fields.getStringSelectValues(`tags-${i}`));
        const error = names.length !== 1
            ? (names.length ? 'Select only one tag.' : 'Select a tag.')
            : !this.findTag(names[0]!) && 'That tag no longer exists.';
        if (error) {
            await submit.reply({ content: error, flags: MessageFlags.Ephemeral });
            await sleep(15 * 1000);
            await deleteWithRetry(() => submit.deleteReply());
            return;
        }

        await submit.reply({
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [], users: [interaction.targetMessage.author.id] },
            components: [
                new TextDisplayBuilder().setContent(`-# ${interaction.targetMessage.author}`),
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(this.getTag(names[0]!)))
                    .setButtonAccessory(new ButtonBuilder()
                        .setCustomId('tag-dismiss')
                        .setLabel('✕')
                        .setStyle(ButtonStyle.Secondary))
            ]
        });
    }

    private findTag(name: string) {
        return this.container.tags.find(tag => tag.name === name || tag.aliases.includes(name));
    }

    private getTag(name: string) {
        const tag = this.findTag(name);

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

        registry.registerContextMenuCommand((builder) => builder
            .setName('Reply with tag')
            .setType(ApplicationCommandType.Message));
    }
}
