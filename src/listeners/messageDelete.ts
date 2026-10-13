import { Events, Listener } from '@sapphire/framework';
import { get } from '@sapphire/plugin-editable-commands';
import type { Message, PartialMessage } from 'discord.js';

export class MessageDeleteListener extends Listener<typeof Events.MessageDelete> {
    public override async run(message: Message | PartialMessage) {
        if (message.partial) return;
        await get(message)?.delete().catch(() => null);
    }
}
