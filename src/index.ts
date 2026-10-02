import 'dotenv/config';

import { container, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { readTagsFile } from '#lib/tags';

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
    loadMessageCommandListeners: true,
    allowedMentions: {
        parse: ['users'],
        repliedUser: false
    },
    typing: true
});

container.tags = await readTagsFile();

const { TOKEN } = process.env;
if (!TOKEN) {
    console.error('TOKEN environment variable not set.');
    process.exit(1);
}

void client.login(TOKEN);
