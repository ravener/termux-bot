import { deleteWithRetry } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { sleep } from '@sapphire/utilities';
import { MessageFlags, type ButtonInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({ interactionHandlerType: InteractionHandlerTypes.Button })
export class TagDismissButtonHandler extends InteractionHandler {
    public override parse(interaction: ButtonInteraction) {
        return interaction.customId === 'tag-dismiss' ? this.some() : this.none();
    }

    public override async run(interaction: ButtonInteraction) {
        if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
            await interaction.reply({
                content: 'Only the person who used the tag can dismiss it.',
                flags: MessageFlags.Ephemeral
            });
            await sleep(15 * 1000);
            await deleteWithRetry(() => interaction.deleteReply());
            return;
        }

        await interaction.deferUpdate();
        await deleteWithRetry(() => interaction.message.delete());
    }
}
