# Storage

## Purpose

Specify phrase storage architecture and provide atomic implementation tasks for metadata persistence, audio asset management, categories, search indexes, import/export, migrations, and backup/restore.

## Scope

- SQLite as system of record for phrase/category/settings metadata
- Filesystem blob store for audio assets
- FTS5 search
- Import/export packs and backups
- Out of scope: cloud sync

## Dependencies

- [architecture.md](architecture.md)
- [backend.md](backend.md) Phrase/Category/ImportExport services
- [security.md](security.md) path and file validation
- [decisions.md](decisions.md) SQLite vs JSON ADR
- better-sqlite3 or equivalent Node SQLite binding; SQLCipher optional (not required v1)

## Deliverables

- Decision summary SQLite vs JSON
- Schema responsibility checklist
- Atomic storage tasks with completion gate

## Completion Criteria

* [x] SQLite chosen and justified with migration path from any prototype JSON
* [x] Schema, FTS, assets, import/export, backup fully tasked
* [x] Path containment and integrity checks tasked
* [x] One-commit-sized tasks throughout

---

## 1. SQLite vs JSON Decision Tasks

* [ ] Record ADR: SQLite for metadata (see [decisions.md](decisions.md))
* [ ] Prototype note: allow temporary JSON only for spike; not production
* [ ] Define migration utility from spike JSON → SQLite if needed
* [ ] Reject dual-write production design for v1
* [ ] Confirm FTS5 availability in selected SQLite build

---

## 2. Database Bootstrap

* [ ] Create database file at app data path
* [ ] Open SQLite with WAL mode
* [ ] Enable foreign keys pragma
* [ ] Set busy timeout
* [ ] Create `schema_migrations` table
* [ ] Implement migration runner
* [ ] Implement migration checksum recording
* [ ] Fail app start on failed migration with actionable log
* [ ] Create DB backup before destructive migrations

---

## 3. Core Schema — Phrases

* [ ] Create `phrases` table with `id` TEXT PK (UUID)
* [ ] Add `title` TEXT NOT NULL
* [ ] Add `category_id` TEXT NULL FK
* [ ] Add `notes` TEXT NULL
* [ ] Add `asset_rel_path` TEXT NOT NULL
* [ ] Add `asset_sha256` TEXT NOT NULL
* [ ] Add `mime_type` TEXT NOT NULL
* [ ] Add `duration_ms` INTEGER NOT NULL
* [ ] Add `default_gain_db` REAL NOT NULL DEFAULT 0
* [ ] Add `hotkey` TEXT NULL
* [ ] Add `play_count` INTEGER NOT NULL DEFAULT 0
* [ ] Add `last_used_at` TEXT NULL
* [ ] Add `created_at` TEXT NOT NULL
* [ ] Add `updated_at` TEXT NOT NULL
* [ ] Add `deleted_at` TEXT NULL for soft delete
* [ ] Add unique index on `hotkey` where not null
* [ ] Add index on `category_id`
* [ ] Add index on `last_used_at`
* [ ] Add index on `title`

---

## 4. Core Schema — Categories

* [ ] Create `categories` table with `id` TEXT PK
* [ ] Add `name` TEXT NOT NULL
* [ ] Add `parent_id` TEXT NULL FK
* [ ] Add `sort_order` INTEGER NOT NULL DEFAULT 0
* [ ] Add `created_at` / `updated_at`
* [ ] Seed default `Uncategorized` category
* [ ] Unique constraint on `(parent_id, name)`

---

## 5. Core Schema — Tags

* [ ] Create `tags` table
* [ ] Create `phrase_tags` junction table
* [ ] Index tag names
* [ ] Cascade cleanup on phrase hard delete

---

## 6. Settings Storage

* [ ] Create `settings` key-value table OR single JSON document table
* [ ] Store settings schema version
* [ ] Implement get/set settings repository methods
* [ ] Atomic replace for JSON document settings

---

## 7. Search Indexes (FTS5)

* [ ] Create FTS5 virtual table `phrases_fts`
* [ ] Include title in FTS
* [ ] Include notes in FTS
* [ ] Include tags concatenated field in FTS
* [ ] Create triggers to sync FTS on insert
* [ ] Create triggers to sync FTS on update
* [ ] Create triggers to sync FTS on delete
* [ ] Implement search repository method using MATCH
* [ ] Implement safe query sanitization for FTS
* [ ] Implement BM25/order by rank
* [ ] Rebuild FTS maintenance command

---

## 8. Metadata Fields & Validation

* [ ] Validate title length 1–200
* [ ] Validate notes length max
* [ ] Validate tag count max
* [ ] Validate tag length
* [ ] Validate gain_db range
* [ ] Validate hotkey format string
* [ ] Validate mime_type allowlist
* [ ] Validate duration_ms > 0
* [ ] Validate UUID format for ids

---

## 9. Audio Asset Store

* [ ] Create assets root directory on first run
* [ ] Create per-phrase subdirectory
* [ ] Store original filename sidecar metadata in DB
* [ ] Copy inbound files with unique names
* [ ] Prefer preserving extension from validated type
* [ ] Write assets using temp + rename
* [ ] Read asset absolute path resolver with root jail
* [ ] Delete asset files on hard delete
* [ ] Soft delete retains assets until purge job
* [ ] Implement purge soft-deleted older than N days
* [ ] Implement orphan asset scanner
* [ ] Implement orphan asset delete dry-run
* [ ] Implement orphan asset delete execute
* [ ] Verify sha256 on play optional setting
* [ ] Enforce max asset size bytes
* [ ] Enforce max total library size warning threshold

---

## 10. Categories Operations

* [ ] Repository: insert category
* [ ] Repository: rename category
* [ ] Repository: reorder categories transactionally
* [ ] Repository: delete category
* [ ] Reassign phrases to Uncategorized on delete
* [ ] Prevent cycles in parent_id tree
* [ ] Limit max nesting depth

---

## 11. Phrase CRUD Repository

* [ ] Insert phrase transaction (row + fts + tags)
* [ ] Update phrase transaction
* [ ] Soft delete phrase
* [ ] Hard delete phrase
* [ ] Get phrase by id including tags
* [ ] List phrases paginated
* [ ] List by category
* [ ] Increment play_count transactionally
* [ ] Update last_used_at
* [ ] Duplicate phrase including asset file copy

---

## 12. Import / Export Formats

* [ ] Define `phrase-pack.v1.json` manifest schema
* [ ] Include pack `id`, `createdAt`, `appVersion`, `phrases[]`
* [ ] Include relative asset paths inside zip
* [ ] Export zip writer task
* [ ] Import zip reader task
* [ ] Validate manifest schema on import
* [ ] Validate each asset hash on import
* [ ] Validate each audio file independently
* [ ] Import transaction per phrase or whole pack atomic option
* [ ] Collision policy: skip
* [ ] Collision policy: replace
* [ ] Collision policy: duplicate-as-new
* [ ] Export filtered by category
* [ ] Export filtered by selection
* [ ] Include categories in pack
* [ ] Round-trip test fixture pack

---

## 13. Backup & Restore

* [ ] Scheduled backup setting (off by default)
* [ ] Manual backup command: copy DB + assets snapshot
* [ ] Backup naming with timestamp
* [ ] Retain last N backups
* [ ] Restore from backup with confirm
* [ ] Verify DB integrity_check after restore
* [ ] Lock engine play during restore
* [ ] Document backup location in diagnostics

---

## 14. Migrations Beyond v1

* [ ] Migration template documentation
* [ ] Add example no-op migration for tooling proof
* [ ] Ensure migrations are ordered and immutable
* [ ] Add downgrade policy: not supported; backup+forward only

---

## 15. Concurrency & Integrity

* [ ] Serialize writers via main-process single owner
* [ ] Use transactions for multi-row updates
* [ ] Handle SQLITE_BUSY with retry
* [ ] Run `PRAGMA integrity_check` on startup optional/dev
* [ ] Detect disk full errors and surface codes

---

## 16. Storage Testing Tasks

* [ ] Unit test phrase insert/get
* [ ] Unit test FTS search finds title
* [ ] Unit test FTS search finds tag
* [ ] Unit test soft delete hides from default list
* [ ] Unit test hotkey uniqueness enforcement
* [ ] Unit test import rollback on bad asset
* [ ] Unit test path jail rejects `..`
* [ ] Integration test duplicate phrase copies asset bytes

---

## 17. Storage Completion Gate

* [ ] Fresh profile creates DB and Uncategorized
* [ ] CRUD phrases survives app restart
* [ ] Search returns expected ranks
* [ ] Export/import round-trip preserves audio hash
* [ ] Backup/restore yields identical phrase count
* [ ] Orphan cleanup removes only unreferenced files
