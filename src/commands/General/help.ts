import { Command, type MessageCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import { codeBlock } from '@sapphire/utilities';

@ApplyOptions<Command.Options>({
    description: 'View command help',
    aliases: ['h', 'command', 'commands', 'cmd'],
    preconditions: ['NotGeneral']
})
export class HelpCommand extends Command {
    public override async messageRun(message: Message) {
        const lines = ['= Commands =\n'];

        for (const command of this.store.values()) {
            if (!command.enabled) continue;

            const result = await command.preconditions.messageRun(message, command as MessageCommand, { command: null });
            if (result.isErr()) continue;

            lines.push(`${command.name.padEnd(12)} :: ${command.description ?? 'No Description Provided'}`);
        }

        return message.reply(codeBlock('asciidoc', lines.join('\n')));
    }
}
