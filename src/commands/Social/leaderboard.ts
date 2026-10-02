import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { codeBlock } from '@sapphire/utilities';
import type { ChatInputCommandInteraction, Message, User } from 'discord.js';
import { desc } from 'drizzle-orm';

const getUsers = db
    .select()
    .from(users)
    .orderBy(desc(users.points))
    .prepare();

@ApplyOptions<Command.Options>({
    description: 'View the most active users',
    runIn: ['GUILD_TEXT'],
    aliases: ['lb'],
    preconditions: ['NotGeneral']
})
export class LeaderboardCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const page = await args.pick('number').catch(() => 1);
        await this.buildLeaderboard(message, message.author, page);
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const page = interaction.options.getInteger('page') ?? 1;
        await this.buildLeaderboard(interaction, interaction.user, page);
    }

    private async buildLeaderboard(target: Message | ChatInputCommandInteraction, author: User, currentPage: number) {
        const rows = getUsers.all();

        if (!rows.length) {
            throw 'No results found, is this a dead server?';
        }

        const totalPages = Math.max(Math.ceil(rows.length / 10), 1);
        if (currentPage > totalPages) {
            throw `Page ${currentPage} does not exist, there are only ${totalPages} page${totalPages > 1 ? 's' : ''}.`;
        }

        const authorPosition = rows.findIndex(row => row.id === author.id);
        const { client } = this.container;

        const start = (currentPage - 1) * 10;
        const pageRows = rows.slice(start, start + 10);
        const leaderboard: string[] = [];

        for (const [index, row] of pageRows.entries()) {
            const position = start + index + 1;
            const points = Number(row.points);
            const user = await client.users.fetch(row.id);

            leaderboard.push(
                `- ${String(position).padStart(2, '0')} ❯ ${user.username}\n` +
                `    => ${points.toLocaleString()} bit${points > 1 ? 's' : ''}`
            );
        }

        if (authorPosition === -1) {
            leaderboard.push(
                `\n+ [??] ❯ ${author.username}\n` +
                `    => 0 bits`
            );
        } else {
            const authorPoints = Number(rows[authorPosition]!.points);

            leaderboard.push(
                `\n+ [${String(authorPosition + 1).padStart(2, '0')}] ❯ ${author.username}\n` +
                `    => ${authorPoints.toLocaleString()} bit${authorPoints > 1 ? 's' : ''}`
            );
        }

        const lb = codeBlock(leaderboard.join('\n'));
        await target.reply(`Leaderboard (Page **${currentPage}** out of **${totalPages}**)\n${lb}`);
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addIntegerOption(option => option
                .setName('page')
                .setDescription('The page number to view')
                .setMinValue(1)
            )
        );
    }
}
