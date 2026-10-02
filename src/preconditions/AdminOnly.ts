import { Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, Message } from 'discord.js';

const { ADMINS = '' } = process.env;
const admins = ADMINS.split(',');

export class AdminOnlyPrecondition extends Precondition {
    public override async messageRun(message: Message) {
        return this.checkAdmin(message.author.id);
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        return this.checkAdmin(interaction.user.id);
    }

    private checkAdmin(userId: string) {
        return admins.includes(userId)
            ? this.ok()
            : this.error({ message: 'This command can only be used by Bot Admins' });
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        AdminOnly: never;
    }
}
