import { Listener, UserError, type Events, type MessageCommandErrorPayload } from '@sapphire/framework';

export class MessageCommandError extends Listener<typeof Events.MessageCommandError> {
    public override async run(error: unknown, context: MessageCommandErrorPayload) {
        const { message } = context;

        if (typeof error === 'string') {
            return message.reply({
                content: error,
                allowedMentions: { users: [message.author.id], roles: [] }
            });
        }

        if (error instanceof UserError) {
            return message.reply({
                content: error.message,
                allowedMentions: { users: [message.author.id], roles: [] }
            });
        }

        const { name, location } = context.command;
		this.container.logger.error(`Encountered error on chat input command "${name}" at path "${location.full}"`, error);

        await message.reply(`Something went wrong while running \`${name}\`. Please report this to the devs.`);
    }
}
