import { Args, Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { AutocompleteInteraction, EmbedBuilder, Locale, MessageFlags, type ChatInputCommandInteraction, type Message } from 'discord.js';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';

// Check these platforms in order. (Prioritize Android and Unix)
const platforms = [
    'android',
    'linux',
    'common',
    'freebsd',
    'netbsd',
    'openbsd',
    'osx',
    'sunos',
    'windows',
    'dos',
    'cisco-ios'
];

// Requires https://github.com/tldr-pages/tldr cloned in the root of the project.
async function getPage(command: string, language = 'en') {
    for (const platform of platforms) {
        const lang = language === 'en' ? '' : `.${language}`;
        const path = `tldr/pages${lang}/${platform}/${command}.md`;

        if (existsSync(path)) {
            const page = await readFile(path, 'utf-8');
            const split = page.split('\n');
            const title = split.shift()?.replace('# ', '') ?? command;
            const description = split.join('\n');

            return { title, description, platform };
        }
    }
}

const choices = await readdir('tldr/pages', { recursive: true })
    .then(files => files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', '')));

// Map user's discord locale to tldr locales
const localePages: Partial<Record<Locale, string>> = {
    [Locale.Bulgarian]: 'bg',
    [Locale.ChineseCN]: 'zh',
    [Locale.ChineseTW]: 'zh_TW',
    [Locale.Czech]: 'cs',
    [Locale.Danish]: 'da',
    [Locale.Dutch]: 'nl',
    [Locale.EnglishUS]: 'en',
    [Locale.Finnish]: 'fi',
    [Locale.French]: 'fr',
    [Locale.German]: 'de',
    [Locale.Greek]: 'el',
    [Locale.Hindi]: 'hi',
    [Locale.Indonesian]: 'id',
    [Locale.Italian]: 'it',
    [Locale.Japanese]: 'ja',
    [Locale.Korean]: 'ko',
    [Locale.Norwegian]: 'no',
    [Locale.Polish]: 'pl',
    [Locale.PortugueseBR]: 'pt_BR',
    [Locale.Romanian]: 'ro',
    [Locale.Russian]: 'ru',
    [Locale.SpanishES]: 'es',
    [Locale.Swedish]: 'sv',
    [Locale.Thai]: 'th',
    [Locale.Turkish]: 'tr',
    [Locale.Ukrainian]: 'uk',
};

@ApplyOptions<Command.Options>({
    description: 'TL;DR man pages',
    aliases: ['man', 'manual', 'cheat', 'cheat-sheet']
})
export class TLDRCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const command = await args.pick('string');
        const language = await args.pick('string').catch(() => 'en');
        const embed = await this.buildManual(command, language ?? 'en');

        await message.reply({ embeds: [embed] });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const command = interaction.options.getString('command', true);
        const embed = await this.buildManual(command, localePages[interaction.locale] ?? 'en');

        // Since these could be translated to user's locale, we should make this ephemeral to avoid spamming the channel with non-English messages.
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    private async buildManual(command: string, language: string) {
        const page = await getPage(command, language);

        if (!page) {
            throw `No manual entry for \`${command}\` was found.`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFAB87)
            .setTitle(`${page.title} (${page.platform})`)
            .setDescription(page.description);

        return embed;
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'command') {
            const filtered = choices.filter(choice => choice.startsWith(focusedOption.value)).slice(0, 25);
            await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        const localeNames = Object.fromEntries(Object.entries(Locale).map(([name, value]) => [value, name]));
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option => option
                .setName('command')
                .setDescription('The command to lookup the manual for')
                .setRequired(true)
                .setAutocomplete(true)
            )
        );
    }
}
