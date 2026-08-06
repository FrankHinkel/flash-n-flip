CREATE TABLE "device_pairings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_a_id" uuid NOT NULL,
	"device_b_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pairing_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"initiator_device_id" uuid NOT NULL,
	"joining_device_id" uuid,
	"state" text DEFAULT 'CREATED' NOT NULL,
	"initiator_ephemeral_public_key" text NOT NULL,
	"initiator_fingerprint_proof" text NOT NULL,
	"joining_ephemeral_public_key" text,
	"joining_fingerprint_proof" text,
	"initiator_confirmation_proof" text,
	"joining_confirmation_proof" text,
	"initiator_confirmed" boolean DEFAULT false NOT NULL,
	"joining_confirmed" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pairing_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"sender_device_id" uuid NOT NULL,
	"recipient_device_id" uuid NOT NULL,
	"sequence" integer GENERATED ALWAYS AS IDENTITY (sequence name "pairing_signals_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"platform" text NOT NULL,
	"public_key" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_device_a_id_user_devices_id_fk" FOREIGN KEY ("device_a_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_device_b_id_user_devices_id_fk" FOREIGN KEY ("device_b_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_initiator_device_id_user_devices_id_fk" FOREIGN KEY ("initiator_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_joining_device_id_user_devices_id_fk" FOREIGN KEY ("joining_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_signals" ADD CONSTRAINT "pairing_signals_session_id_pairing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pairing_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_signals" ADD CONSTRAINT "pairing_signals_sender_device_id_user_devices_id_fk" FOREIGN KEY ("sender_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_signals" ADD CONSTRAINT "pairing_signals_recipient_device_id_user_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_pairings_identity_unique" ON "device_pairings" USING btree ("user_id","device_a_id","device_b_id");--> statement-breakpoint
CREATE INDEX "device_pairings_device_a_idx" ON "device_pairings" USING btree ("user_id","device_a_id");--> statement-breakpoint
CREATE INDEX "device_pairings_device_b_idx" ON "device_pairings" USING btree ("user_id","device_b_id");--> statement-breakpoint
CREATE INDEX "pairing_sessions_user_idx" ON "pairing_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pairing_sessions_expiry_idx" ON "pairing_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pairing_signals_session_sequence_idx" ON "pairing_signals" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "pairing_signals_recipient_idx" ON "pairing_signals" USING btree ("recipient_device_id","sequence");--> statement-breakpoint
CREATE INDEX "user_devices_user_idx" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_public_key_unique" ON "user_devices" USING btree ("user_id","public_key");--> statement-breakpoint
