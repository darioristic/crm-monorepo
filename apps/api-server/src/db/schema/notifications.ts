import { pgTable, pgEnum, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
	"info",
	"success",
	"warning",
	"error",
	"invoice_created",
	"invoice_paid",
	"invoice_overdue",
	"quote_created",
	"quote_accepted",
	"quote_rejected",
	"task_assigned",
	"task_completed",
	"task_overdue",
	"project_created",
	"project_completed",
	"lead_assigned",
	"deal_won",
	"deal_lost",
	"system",
	"mention",
	"reminder",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
	"in_app",
	"email",
	"both",
]);

// Notifications table
export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		type: notificationTypeEnum("type").notNull().default("info"),
		channel: notificationChannelEnum("channel").notNull().default("in_app"),
		title: varchar("title", { length: 255 }).notNull(),
		message: text("message").notNull(),
		link: varchar("link", { length: 500 }),
		entityType: varchar("entity_type", { length: 50 }),
		entityId: uuid("entity_id"),
		isRead: boolean("is_read").notNull().default(false),
		readAt: timestamp("read_at", { withTimezone: true }),
		emailSent: boolean("email_sent").notNull().default(false),
		emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
		metadata: text("metadata"), // JSON stored as text
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_notifications_user_id").on(table.userId),
		index("idx_notifications_is_read").on(table.isRead),
		index("idx_notifications_type").on(table.type),
		index("idx_notifications_created_at").on(table.createdAt),
		index("idx_notifications_entity").on(table.entityType, table.entityId),
	]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

