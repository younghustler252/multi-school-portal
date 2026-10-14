import { INotificationChannel } from "./channel.interface";

export class ChannelRegistry {
    private readonly channels = new Map<string, INotificationChannel>();

    register(channel: INotificationChannel): void {
        this.channels.set(channel.channel, channel);
    }

    get(channel: string): INotificationChannel {
        const provider = this.channels.get(channel);
        if (!provider) {
            throw new Error(`No notification channel provider registered for "${channel}"`);
        }
        return provider;
    }

    has(channel: string): boolean {
        return this.channels.has(channel);
    }
}