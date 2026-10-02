import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import type { ChatInputCommandInteraction, Message, User } from 'discord.js';
import { eq, sql } from 'drizzle-orm';

const getUser = db
    .select()
    .from(users)
    .where(eq(users.id, sql.placeholder('id')))
    .prepare();

@ApplyOptions<Command.Options>({
    description: 'Check your current activity points',
    runIn: ['GUILD_TEXT'],
    aliases: ['balance', 'bal', 'pts', 'level'],
    preconditions: ['NotGeneral']
})
export class PointsCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const user = await args.pickResult('user');
        const points = await this.calculatePoints(user.unwrapOr(message.author), !user.isOk());
        await message.reply(points);
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user', false);
        const points = await this.calculatePoints(user ?? interaction.user, !user);
        await interaction.reply(points);
    }

    private async calculatePoints(user: User, self: boolean): Promise<string> {
        const dbUser = getUser.get({ id: user.id });
        const points = dbUser?.points;

        if (!points) {
            return `${self ? 'You have' : 'That user has'} no points.`;
        }

        const level = Math.floor(0.1 * Math.sqrt(points)) + 1
        const bits = points.toLocaleString();
        const nextLevel = Math.pow(level + 1, 2) * 100;
        const nextPoints = (nextLevel - points).toLocaleString();

        return [
            `${self ? 'You are' : `${user.username} is`} currently level **${level}** with **${bits}** bits.`,
            `${self ? 'You' : 'They'} need **${nextLevel.toLocaleString()}** bits for the next level (**${nextPoints}** more to go!)`
        ].join('\n');
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to check the points of')
                .setRequired(false)
            )
        );
    }
}
