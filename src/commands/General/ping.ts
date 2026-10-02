import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Pong! Checks bot latency',
    preconditions: ['NotGeneral']
})
export class PingCommand extends Command {
    public override async messageRun(message: Message) {
        const msg = await message.reply('Ping?');
        const took = msg.createdTimestamp - message.createdTimestamp;
        await msg.edit(`Pong! It took **${took}ms** to reply.`);
    }
}
