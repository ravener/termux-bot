import { searchWiki } from '#lib/wiki';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { EmbedBuilder, type ChatInputCommandInteraction, type Message } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Search for an article in the Termux Wiki',
    aliases: ['w', 'wk', 'termux-wiki']
})
export class WikiCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const query = await args.rest('string');
        const embed = await this.search(query);

        await message.reply({ embeds: [embed] });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const query = interaction.options.getString('query', true);
        const embed = await this.search(query);

        await interaction.reply({ embeds: [embed] });
    }

    private async search(query: string) {
        const results = await searchWiki(query);
        const description = results.map(page => `- [${page.title}](${page.fullurl})`);
        const embed = new EmbedBuilder()
            .setTitle(`Wiki search for '${query}'`)
            .setColor(0xFFAB87)
            .setDescription(description.join('\n'));

        return embed;
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option => option
                .setName('query')
                .setDescription('The query to search')
                .setRequired(true)
            )
        );
    }
}
