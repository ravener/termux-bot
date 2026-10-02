import { readTagsFile } from '#lib/tags';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { isObject } from '@sapphire/utilities';
import type { Message } from 'discord.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const GIT_PULL = 'git pull';

interface ExecError {
    code: number;
    stdout: string;
    stderr: string;
}

function isExecError(err: unknown): err is ExecError {
    return isObject(err) && 'stdout' in err && 'stderr' in err && 'code' in err;
}

function formatOutput(stdout?: string, stderr?: string) {
    const output = stdout ? `**\`OUTPUT\`**${'```prolog\n' + stdout + '```'}` : '';
    const outerr = stderr ? `**\`ERROR\`**${'```prolog\n' + stderr + '```'}` : '';

    return [output, outerr].join('\n');
}

@ApplyOptions<Command.Options>({
    aliases: ['rt', 'rtags'],
    preconditions: ['AdminOnly'],
    description: 'Updates and reloads the tags database',
    runIn: ['GUILD_TEXT']
})
export class ReloadTagsCommand extends Command {
    public override async messageRun(message: Message) {
        try {
            const result = await execAsync(GIT_PULL, { timeout: 60000 })
            const output = formatOutput(result.stdout, result.stderr);

            if (!output) {
                await message.reply('No output returned.');
                return;
            }

            this.container.tags = await readTagsFile();
            await message.reply(`${output}\nLoaded ${this.container.tags.length} tags.`);
        } catch (err: unknown) {
            if (isExecError(err)) {
                const output = formatOutput(err.stdout, err.stderr);
                await message.reply(`Error running command (code: ${err.code}):\n${output}`);
                return;
            }

            await message.reply(`Something went wrong: \`${err}\``);
        }
    }
}
