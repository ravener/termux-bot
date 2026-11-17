import { Categories, Channels, ReactionEmojis, Roles } from '#lib/constants';
import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { checkSpam } from '#lib/spam';
import { Events, Listener } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';
import { EmbedBuilder, type GuildMember, type Message } from 'discord.js';
import { sql } from 'drizzle-orm';

const upsertUser = db
    .insert(users)
    .values({
        id: sql.placeholder('id'),
        points: sql.placeholder('points'),
    })
    .onConflictDoUpdate({
        target: users.id,
        set: {
            points: sql`${users.points} + ${sql.placeholder('points')}`,
        },
    })
    .returning()
    .prepare();

const UNICODE_REACTIONS = ['👾', '🪩', '😺', '😸'];

const timeouts = new Set<string>();

export class NonPrefixedMessageListener extends Listener<typeof Events.NonPrefixedMessage> {
    public override async run(message: Message) {
        if (!message.inGuild()) return;
        if (message.author.bot || message.webhookId) return;

        if (await checkSpam(message)) return;
        await this.handleMention(message);
        await this.handlePoints(message);
    }

    private async handleMention(message: Message<true>) {
        const { user } = this.container.client;
        if (!user || !message.mentions.has(user, { ignoreEveryone: true, ignoreRoles: true, ignoreRepliedUser: true })) return;

        const custom = ReactionEmojis.flatMap((id) => message.guild.emojis.cache.get(id) ?? []);
        await message.react(pickRandom([...custom, ...UNICODE_REACTIONS])).catch(() => null);
    }

    private async handlePoints(message: Message<true>) {
        if (!message.member) return;

        const excludedChannels = [Channels.Memes, Channels.Bots] as string[];
        if (excludedChannels.includes(message.channel.id)) return;

        if (message.channel.parentId) {
            const excludedCategories = [Categories.Staff] as string[];
            if (excludedCategories.includes(message.channel.parentId)) return;
        }

        if (timeouts.has(message.author.id)) return;

        // Random point between 4-12
        // Proficient channel restricted to a fixed 4 point
        const points = message.channel.id === Channels.Proficient ? 4 : Math.floor(Math.random() * 9) + 4;
        const user = upsertUser.get({ id: message.author.id, points });

        timeouts.add(message.author.id);
        setTimeout(() => timeouts.delete(message.author.id), 6000);

        if (user && user.points >= 4096) {
            await this.activeRoleHandout(message.member);
        }
    }

    private async activeRoleHandout(member: GuildMember) {
        if (member.roles.cache.has(Roles.Active)) return;
        await member.roles.add(Roles.Active);

        const modlogs = member.guild.channels.cache.get(Channels.Modlogs);
        if (!modlogs || !modlogs.isSendable()) {
            this.container.logger.warn('Modlogs channel not found.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Active Role Handout')
            .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
            .setDescription(`Given the active role to **${member.user.tag}**`)
            .setFooter({ text: `User ID: ${member.id}` });

        await modlogs.send({ embeds: [embed] });
    }
}
