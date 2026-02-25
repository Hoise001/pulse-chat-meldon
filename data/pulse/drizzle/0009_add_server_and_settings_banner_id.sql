DO $do$ BEGIN
ALTER TABLE "servers" ADD COLUMN "banner_id" integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $do$;

DO $do$ BEGIN
ALTER TABLE "settings" ADD COLUMN "banner_id" integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $do$;

DO $do$ BEGIN
ALTER TABLE "servers" ADD CONSTRAINT "servers_banner_id_files_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

DO $do$ BEGIN
ALTER TABLE "settings" ADD CONSTRAINT "settings_banner_id_files_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;
