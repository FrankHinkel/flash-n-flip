CREATE TABLE "account_share_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"sender_device_id" uuid NOT NULL,
	"recipient_device_id" uuid,
	"state" text DEFAULT 'CREATED' NOT NULL,
	"secret_hash" text NOT NULL,
	"sender_ephemeral_public_key" text NOT NULL,
	"sender_fingerprint_proof" text NOT NULL,
	"recipient_ephemeral_public_key" text,
	"recipient_fingerprint_proof" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "account_share_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"sender_device_id" uuid NOT NULL,
	"recipient_device_id" uuid NOT NULL,
	"sequence" integer GENERATED ALWAYS AS IDENTITY (sequence name "account_share_signals_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_share_sessions" ADD CONSTRAINT "account_share_sessions_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_sessions" ADD CONSTRAINT "account_share_sessions_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_sessions" ADD CONSTRAINT "account_share_sessions_sender_device_id_user_devices_id_fk" FOREIGN KEY ("sender_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_sessions" ADD CONSTRAINT "account_share_sessions_recipient_device_id_user_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_signals" ADD CONSTRAINT "account_share_signals_session_id_account_share_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."account_share_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_signals" ADD CONSTRAINT "account_share_signals_sender_device_id_user_devices_id_fk" FOREIGN KEY ("sender_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_share_signals" ADD CONSTRAINT "account_share_signals_recipient_device_id_user_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_share_sessions_secret_hash_unique" ON "account_share_sessions" USING btree ("secret_hash");--> statement-breakpoint
CREATE INDEX "account_share_sessions_sender_idx" ON "account_share_sessions" USING btree ("sender_user_id","state");--> statement-breakpoint
CREATE INDEX "account_share_sessions_recipient_idx" ON "account_share_sessions" USING btree ("recipient_user_id","state");--> statement-breakpoint
CREATE INDEX "account_share_sessions_expiry_idx" ON "account_share_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "account_share_signals_session_sequence_idx" ON "account_share_signals" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "account_share_signals_recipient_idx" ON "account_share_signals" USING btree ("recipient_device_id","sequence");