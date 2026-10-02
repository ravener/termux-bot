import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { version, type Message } from 'discord.js';
import { version as sapphireVersion } from '@sapphire/framework';
import { codeBlock } from '@sapphire/utilities';
import { getBytes } from '#lib/utils';

@ApplyOptions<Command.Options>({
    description: 'Returns bot statistics',
    aliases: ['info', 'statistics', 'bot-info'],
    preconditions: ['NotGeneral']
})
export class StatsCommand extends Command {
    public override async messageRun(message: Message) {
        const { client } = this.container;

        const lines = [
            `= Bot Statistics =`,
            '',
            `• Uptime             :: ${getDuration(client.uptime ?? 0)}`,
            `• Memory Usage       :: ${getBytes(process.memoryUsage().heapUsed)}`,
            `• Operating System   :: ${process.platform} (${process.arch})`,
            `• Node.js Version    :: ${process.version}`,
            `• Discord.js Version :: ${version}`,
            `• Sapphire Version   :: ${sapphireVersion}`
        ];

        return message.reply(codeBlock('asciidoc', lines.join('\n')));
    }
}

/**
 * Convert milliseconds into human readable duration string.
 */
export function getDuration(time: number) {
    if (time < 1000) return `${time} ms`;

    const seconds = Math.floor(time / 1000) % 60 ;
    const minutes = Math.floor((time / (1000 * 60)) % 60);
    const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
    const days = Math.floor((time / (1000 * 60 * 60 * 24)) % 7);

    return [
        `${days} d`,
        `${hours} h`,
        `${minutes} m`,
        `${seconds} s`
    ].filter(time => !time.startsWith('0')).join(', ');
}

