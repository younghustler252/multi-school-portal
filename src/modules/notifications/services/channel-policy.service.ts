import { EntitlementsService } from "../../../foundation/entitlements.service";
import { preferencesOf, PreferencesReader } from "../../../foundation/settings.registry";
import type { DispatchChannel } from "./notification-dispatch.service";

export interface ChannelBlock { channel: DispatchChannel; reason: "plan" | "school_setting" }
export interface ChannelDecision { allowed: DispatchChannel[]; blocked: ChannelBlock[] }

const PLAN_FEATURE: Partial<Record<DispatchChannel, string>> = { EMAIL: "notifications.email", SMS: "notifications.sms" };
const PREFERENCE:   Partial<Record<DispatchChannel, string>> = { EMAIL: "notifications.email_enabled", SMS: "notifications.sms_enabled" };

/*
| CHANNEL POLICY: may this school use this channel right now? Both the plan (notifications.email / notifications.sms) and the
| school's own preference (notifications.email_enabled / notifications.sms_enabled) must allow it; in-app is always allowed.
| The announcement sender refuses when a requested channel is blocked; automation quietly uses the allowed ones and says why in its log.
*/
export class ChannelPolicyService {
    constructor(private readonly d: { entitlementsService: EntitlementsService; schoolPreferencesService?: PreferencesReader }) {}

    async evaluate(schoolId: string, channels: readonly DispatchChannel[]): Promise<ChannelDecision> {
        const prefs = await preferencesOf(this.d);
        const out: ChannelDecision = { allowed: [], blocked: [] };
        for (const channel of new Set(channels)) {
            const feature = PLAN_FEATURE[channel];
            if (!feature) { out.allowed.push(channel); continue; }
            const decision = await this.d.entitlementsService.checkFeature(schoolId, feature);
            if (!decision.allowed) { out.blocked.push({ channel, reason: "plan" }); continue; }
            if (prefs[PREFERENCE[channel]!] !== true) { out.blocked.push({ channel, reason: "school_setting" }); continue; }
            out.allowed.push(channel);
        }
        return out;
    }
}
