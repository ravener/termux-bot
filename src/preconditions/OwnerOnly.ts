import { OwnerId } from '#lib/constants';
import { Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

export class OwnerOnlyPrecondition extends Precondition {
    public override async messageRun(message: Message) {
        return this.checkOwner(message.author.id);
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        return this.checkOwner(interaction.user.id);
    }

    public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
        return this.checkOwner(interaction.user.id);
    }

    private async checkOwner(userId: string) {
        return userId === OwnerId
            ? this.ok()
            : this.error({ message: 'Only the bot owner can use this command' });
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        OwnerOnly: never;
    }
}
