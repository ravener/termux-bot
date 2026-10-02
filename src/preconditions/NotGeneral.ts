import { Channels } from '#lib/constants';
import { Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, Message } from 'discord.js';

export class NotGeneralPrecondition extends Precondition {
    public override async messageRun(message: Message) {
        return this.check(message.channelId);
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        return this.check(interaction.channelId);
    }

    private check(channelId: string) {
        return channelId !== Channels.General
            ? this.ok()
            : this.error({
                message: 'You cannot run this command in this channel.',
                context: { silent: true }
            });
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        NotGeneral: never;
    }
}
