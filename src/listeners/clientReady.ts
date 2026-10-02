import { Channels, Messages } from '#lib/constants';
import { everyMinute, formatUserTimes, timezones } from '#lib/timezones';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, SapphireClient } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';
import { EmbedBuilder } from 'discord.js';
import { readFile } from 'node:fs/promises';

interface Status {
    name: string;
    type: number;
}

const statusList = JSON.parse(await readFile('data/status.json', 'utf8')) as Status[];
const ACTIVITY_INTERVAL = 5 * 60 * 1000; // 5 minutes

@ApplyOptions<Listener.Options>({ once: true })
export class ClientReadyListener extends Listener<typeof Events.ClientReady> {
    public override async run(client: SapphireClient<true>) {
        this.container.logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

        this.setActivity();
        setInterval(this.setActivity, ACTIVITY_INTERVAL);
        await this.setupModClock();
    }

    private setActivity = () => {
        const { name, type } = pickRandom(statusList);
        this.container.client.user?.setActivity({ name, type });
    }

    private async setupModClock() {
        const channel = this.container.client.channels.cache.get(Channels.StaffRules);
        if (!channel || !channel.isSendable()) {
            this.container.logger.warn(`Channel with ID ${Channels.StaffRules} not found.`);
            return;
        }

        const message = await channel.messages.fetch(Messages.Timezone);

        everyMinute(async () => {
            if (!timezones.length) return;

            const embed = new EmbedBuilder()
                .setColor(0xFFAB87)
                .setTitle('Current Time in Staff Timezones')
                .setDescription(formatUserTimes(timezones))
                .setFooter({ text: 'Updated every minute' });

            await message.edit({ embeds: [embed] });
        });
    }
}
