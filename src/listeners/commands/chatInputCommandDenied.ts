import { Events, Listener, type ChatInputCommandDeniedPayload, type UserError } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

export class ChatInputCommandDenied extends Listener<typeof Events.ChatInputCommandDenied> {
    public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
                content: error.message
            });
        }

        return interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral
        });
    }
}
