import { Listener, UserError, type Events, type ChatInputCommandErrorPayload } from '@sapphire/framework';
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';

function reply(interaction: ChatInputCommandInteraction, content: string) {
    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content });
    }

    return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
    });
}

export class ChatInputCommandError extends Listener<typeof Events.ChatInputCommandError> {
    public override async run(error: unknown, context: ChatInputCommandErrorPayload) {
        const { interaction } = context;

        if (typeof error === 'string') {
            return reply(interaction, error);
        }

        if (error instanceof UserError) {
            return reply(interaction, error.message);
        }

        const { name, location } = context.command;
		this.container.logger.error(`Encountered error on chat input command "${name}" at path "${location.full}"`, error);

        await reply(interaction, `Something went wrong while running \`${name}\`. Please report this to the devs.`);
    }
}
