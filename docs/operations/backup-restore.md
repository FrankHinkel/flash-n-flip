# Backup and restore

## Required production procedure

1. Create encrypted daily PostgreSQL backups with bounded retention.
2. Version object storage and retain deleted objects only for the approved
   recovery window.
3. Restore into an isolated environment at least quarterly.
4. Verify account, deck, review, revision, moderation, and media consistency.
5. Record duration, missing objects, and the tested commit and schema version.

No public release may rely on a backup that has never been restored.
