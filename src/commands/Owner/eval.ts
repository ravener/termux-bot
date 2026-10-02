import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { Stopwatch } from '@sapphire/stopwatch';
import { codeBlock, isThenable } from '@sapphire/utilities';
import { bold, type Message } from 'discord.js';
import { inspect } from 'node:util';

@ApplyOptions<Command.Options>({
    description: 'Evaluates arbitrary JavaScript',
    preconditions: ['OwnerOnly'],
    aliases: ['ev'],
    flags: ['json', 'hidden', 'showHidden', 'async', 'silent'],
    options: ['depth'],
    quotes: [],
    enabled: process.env.NODE_ENV === 'development'
})
export class EvalCommand extends Command {
    public async messageRun(message: Message, args: Args) {
        const code = await args.rest('string');

        const { success, result, time } = await this.eval(message, code, args);

        if (args.getFlags('silent')) {
            await message.react(success ? '✅' : '❌').catch(() => null);
            return;
        }

        const body = codeBlock(result);
        const header = `${bold(success ? 'Output' : 'Error')}: ${time}`;

        if ([...header, ...body].length > 2000) {
            const file = { attachment: Buffer.from(result, 'utf8'), name: `output.${args.getFlags('json') ? 'json' : 'js'}` } as const;
            return message.reply({ content: header, files: [file] });
        }

        return message.reply(`${header}${body}`);
    }

    private async eval(message: Message, code: string, args: Args): Promise<EvalResults> {
        if (args.getFlags('async')) code = `(async () => {\n${code}\n})();`;

        const stopwatch = new Stopwatch();
        let syncTime = '';
        let asyncTime = '';
        let result: unknown;
        let success: boolean;
        let thenable = false;

        try {
            result = eval(code);
            syncTime = stopwatch.toString();

            if (isThenable(result)) {
                thenable = true;
                stopwatch.restart();
                result = await result;
                asyncTime = stopwatch.toString();
            }

            success = true;
        } catch (err) {
            if (!syncTime.length) syncTime = stopwatch.toString();
            if (thenable && !asyncTime.length) asyncTime = stopwatch.toString();
            result = err;
            success = false;
        }

        stopwatch.stop();
        if (typeof result !== 'string') {
            result =
                result instanceof Error
                    ? result.toString()
                    : args.getFlags('json')
                        ? JSON.stringify(result, null, 4)
                        : inspect(result, {
                            depth: Number(args.getOption('depth') ?? 0) || 0,
                            showHidden: args.getFlags('showHidden', 'hidden')
                        });
        }

        return {
            success,
            result: result as string,
            time: this.formatTime(syncTime, asyncTime)
        };
    }

    private formatTime(syncTime: string, asyncTime?: string) {
        return asyncTime ? `⏱ ${asyncTime}<${syncTime}>` : `⏱ ${syncTime}`;
    }
}

interface EvalResults {
    success: boolean;
    result: string;
    time: string;
}
