import { Events, Listener, type MessageCommandDeniedPayload, type UserError } from '@sapphire/framework';

export class MessageCommandDenied extends Listener<typeof Events.MessageCommandDenied> {
    public override async run(error: UserError, { message }: MessageCommandDeniedPayload) {
        if (Reflect.get(Object(error.context), 'silent')) return;

        if (message.channel.isDMBased()) return;
        await message.channel.send(error.message);
    }
}
