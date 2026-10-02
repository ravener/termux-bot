import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Shuts down the bot',
    preconditions: ['OwnerOnly'],
    aliases: ['sd', 'exit', 'quit', 'stop', 'restart']
})
export class ShutdownCommand extends Command {
    public override async messageRun(message: Message) {
        await message.reply('Shutting down...');
        await this.container.client.destroy();
        process.exit(0);
    }
}
