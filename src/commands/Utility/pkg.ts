import { Args, Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, type APIEmbedField, type ChatInputCommandInteraction, type Message } from 'discord.js';
import { getDownloadURL, getRepository, validArch, validRepos, type Arch, type Repository } from '#lib/pkg';
import { closest } from 'fastest-levenshtein';
import { getBytes } from '#lib/utils';

@ApplyOptions<Command.Options>({
    description: 'Shows information about a package',
    aliases: ['apt', 'repo', 'package']
})
export class PackageCommand extends Command {
    public override async messageRun(message: Message<true>, args: Args) {
        const pkg = await args.pick('string');
        const repo = args.finished ? 'main' : await args.pick('enum', { enum: validRepos }) as Repository;
        const arch = args.finished ? 'aarch64' : await args.pick('enum', { enum: validArch }) as Arch;

        const embed = await this.buildEmbed(pkg, repo, arch);
        const messageReference = message.reference?.messageId ?? message.id;

        // Ping the user the author replied to if the message is a reply, otherwise ping the author of the command
        // Used when you intend the bot's response towards another person
        return message.channel.send({
            embeds: [embed],
            reply: { messageReference },
            allowedMentions: { repliedUser: true }
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const pkg = interaction.options.getString('package', true);
        const repo = interaction.options.getString('repository') as Repository ?? 'main';
        const arch = interaction.options.getString('arch') as Arch ?? 'aarch64';

        const embed = await this.buildEmbed(pkg, repo, arch);
        return interaction.reply({ embeds: [embed] });
    }

    private async buildEmbed(pkg: string, repo: Repository, arch: Arch) {
        pkg = pkg.toLowerCase();
        repo = repo.toLowerCase() as Repository;
        arch = arch.toLowerCase() as Arch;

        const repository = await getRepository(repo, arch);
        const info = repository.get(pkg);

        if (!info) {
            const maybe = closest(pkg, Array.from(repository.keys()));
            throw `Package '${pkg}' not found in repository \`${repo}\` (${arch}). Did you mean '${maybe}'?`;
        }

        const download = `📥 [.deb](${getDownloadURL(repo, info.filename)}) (${getBytes(info.size)})`;

        const fields: APIEmbedField[] = [
            { name: 'Version', value: info.version, inline: true },
            { name: 'Maintainer', value: info.maintainer, inline: true },
            { name: 'Homepage', value: info.homepage, inline: true },
            { name: 'Installed Size', value: getBytes(info.installedSize * 1024), inline: true },
            { name: 'Download', value: download, inline: true },
        ];

        if (info.depends) fields.push({ name: 'Depends', value: info.depends, inline: true });
        if (info.breaks) fields.push({ name: 'Breaks', value: info.breaks, inline: true });
        if (info.replaces) fields.push({ name: 'Replaces', value: info.replaces, inline: true });
        if (info.suggests) fields.push({ name: 'Suggests', value: info.suggests ?? 'None', inline: true });
        if (info.provides) fields.push({ name: 'Provides', value: info.provides, inline: true });
        if (info.essential) fields.push({ name: 'Essential', value: 'Yes', inline: true });

        const hashes = [
            `**MD5:** \`${info.hashes.md5}\``,
            `**SHA1:** \`${info.hashes.sha1}\``,
            `**SHA256:** \`${info.hashes.sha256}\``,
            `**SHA512:** \`${info.hashes.sha512}\``
        ];

        fields.push({ name: 'Hashes', value: hashes.join('\n'), inline: false });

        const embed = new EmbedBuilder()
            .setColor(0xFFAB87)
            .setTitle(`Package Information for '${pkg}' (${arch})`)
            .setDescription(info.description)
            .addFields(...fields);

        return embed;
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option => option
                .setName('package')
                .setDescription('The package to lookup')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('repository')
                .setDescription('The repository to search in (default: main)')
                .setChoices(validRepos.map(r => ({ name: r, value: r })))
            )
            .addStringOption(option => option
                .setName('arch')
                .setDescription('The architecture to lookup (default: aarch64)')
                .setChoices(validArch.map(a => ({ name: a, value: a })))
            )
        );
    }
}
