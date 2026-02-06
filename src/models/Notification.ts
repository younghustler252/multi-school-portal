// models/Notification.ts

import { Schema, model } from "mongoose";
import { INotification, NotificationType, NotificationSender, NotificationChannels, NotificationMeta } from "../types/Notification";
import { UserRole } from "../types/UserRole";

const NotificationSchema = new Schema<INotification>({
    tenantId: { 
        type: Schema.Types.ObjectId, 
        ref: "School", 
        required: true 
    },
    
    recipientId: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },

    recipientRole: { 
        type: String, 
        enum: Object.values(UserRole), 
        required: true 
    },

    title: { 
        type: String, 
        required: true 
    },

    message: { 
        type: String, 
        required: true 
    },

    type: { 
        type: String, 
        enum: Object.values(NotificationType), 
        default: NotificationType.INFO 
    },

    sender: {
        type: String,
        enum: Object.values(NotificationSender),
        default: NotificationSender.SYSTEM,
    },

    isRead: { 
        type: Boolean, 
        default: false 
    },

    channels: {
		type: {
			inApp: { type: Boolean, default: true },
			email: { type: Boolean, default: false },
			push: { type: Boolean, default: false }
		},
		default: () => ({ inApp: true, email: false, push: false })
	} as NotificationChannels,

	meta: {
		type: Schema.Types.Mixed,
		default: {}
	} as NotificationMeta,

	link: {
		type: String,
		trim: true
	},

}, { timestamps: true });

NotificationSchema.index({ tenantId: 1, recipientId: 1, isRead: 1 });

export const Notification = model<INotification>("Notification", NotificationSchema);
