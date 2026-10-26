import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Records which upstream data (and which import run) the database currently holds. */
export const dataVersions = sqliteTable("data_versions", {
  source: text("source").primaryKey(), // e.g. "STEPBible-Data"
  version: text("version").notNull(), // upstream commit SHA or version string
  detail: text("detail"),
  importedAt: text("imported_at").notNull(),
});

/** One row per extended (disambiguated) Strong's number, e.g. G3056, G2491G. */
export const lemmas = sqliteTable(
  "lemmas",
  {
    id: integer("id").primaryKey(),
    strongsId: text("strongs_id").notNull(), // dStrong / extended Strong's (G2491G)
    strongsBase: text("strongs_base").notNull(), // plain Strong's number (G2491)
    greekLemma: text("greek_lemma").notNull(),
    lemmaPlain: text("lemma_plain").notNull(), // accent-stripped, lowercase, for searching
    altLemma: text("alt_lemma"), // TAGNT headword when it differs from TBESG (e.g. G3165 μέ → ἐγώ)
    altLemmaPlain: text("alt_lemma_plain"),
    transliteration: text("transliteration"),
    translitPlain: text("translit_plain"), // ASCII-folded transliteration (archē → arche)
    gloss: text("gloss"),
    lexPos: text("lex_pos"), // TBESG part-of-speech code (e.g. G:N-M)
    occurrenceCount: integer("occurrence_count").notNull().default(0),
    verseCount: integer("verse_count").notNull().default(0),
  },
  t => [
    uniqueIndex("lemmas_strongs_id_idx").on(t.strongsId),
    index("lemmas_plain_idx").on(t.lemmaPlain),
    index("lemmas_alt_plain_idx").on(t.altLemmaPlain),
    index("lemmas_count_idx").on(t.occurrenceCount),
    index("lemmas_strongs_base_idx").on(t.strongsBase),
    index("lemmas_translit_idx").on(t.translitPlain),
  ],
);

/** Long lexicon entries (TBESG / Abbott-Smith), kept apart so list queries stay small. */
export const lemmaDefinitions = sqliteTable("lemma_definitions", {
  lemmaId: integer("lemma_id")
    .primaryKey()
    .references(() => lemmas.id),
  definitionHtml: text("definition_html").notNull(),
});

/**
 * Every word token of the NA28 text as tagged in TAGNT. Crasis forms (κἀγώ …) yield one row
 * per component lemma sharing the same token_position, distinguished by `part`.
 */
export const occurrences = sqliteTable(
  "occurrences",
  {
    id: integer("id").primaryKey(),
    lemmaId: integer("lemma_id")
      .notNull()
      .references(() => lemmas.id),
    bookOrd: integer("book_ord").notNull(), // 1 = Matthew … 27 = Revelation
    book: text("book").notNull(), // TAGNT/OSIS-style code: Mat, Jhn, 1Co …
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    tokenPosition: integer("token_position").notNull(), // TAGNT word number within the verse (#01 → 1)
    part: integer("part").notNull().default(0), // component index for crasis tokens
    surfaceForm: text("surface_form").notNull(), // Greek as printed, incl. trailing punctuation
    surfacePlain: text("surface_plain").notNull(),
    transliteration: text("transliteration"),
    translitPlain: text("translit_plain"), // search key (see normalizeLatin), e.g. "Egeneto" → "egeneto"
    englishGloss: text("english_gloss"), // TAGNT contextual English (BSB-based)
    morphologyCode: text("morphology_code").notNull(), // e.g. V-2ADI-3S
    wordType: text("word_type").notNull(), // TAGNT word type, e.g. NKO, N(k)O
    editionInfo: text("edition_info").notNull(), // e.g. NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
    instance: text("instance"), // TAGNT sStrong+Instance, e.g. G3056_B
  },
  t => [
    index("occ_lemma_ref_idx").on(t.lemmaId, t.bookOrd, t.chapter, t.verse, t.tokenPosition),
    index("occ_ref_idx").on(t.bookOrd, t.chapter, t.verse, t.tokenPosition, t.part),
    index("occ_surface_plain_idx").on(t.surfacePlain),
    index("occ_translit_plain_idx").on(t.translitPlain),
  ],
);

/** Cached English translation text fetched from bible.helloao.org. */
export const verseCache = sqliteTable(
  "verse_cache",
  {
    translation: text("translation").notNull(),
    book: text("book").notNull(),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    text: text("text").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  t => [primaryKey({ columns: [t.translation, t.book, t.chapter, t.verse] })],
);

/** Chapters already fetched (so we can tell "fetched but verse missing" from "not fetched"). */
export const chapterFetches = sqliteTable(
  "chapter_fetches",
  {
    translation: text("translation").notNull(),
    book: text("book").notNull(),
    chapter: integer("chapter").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  t => [primaryKey({ columns: [t.translation, t.book, t.chapter] })],
);

export const aiAnalyses = sqliteTable(
  "ai_analyses",
  {
    id: integer("id").primaryKey(),
    cacheKey: text("cache_key").notNull(),
    passageReference: text("passage_reference").notNull(), // e.g. Jhn.1.6
    // Not a foreign key: lemma rows are replaced on re-import, analyses survive (keyed by source version).
    selectedLemmaId: integer("selected_lemma_id"),
    selectedTokenPosition: integer("selected_token_position"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    sourceVersion: text("source_version").notNull(),
    analysisJson: text("analysis_json").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  t => [uniqueIndex("ai_analyses_cache_key_idx").on(t.cacheKey)],
);

/**
 * Each user's one-line memo per lemma, typically where the word is written up in their own
 * exegetical notebook (e.g. "ノート1巻 p.4-7"). Keyed by extended Strong's number (not lemma id) so
 * memos survive data re-imports. user_id "" marks memos from before accounts existed; the first
 * administrator claims them on registration.
 */
export const lemmaNotes = sqliteTable(
  "lemma_notes",
  {
    userId: text("user_id").notNull(),
    strongsId: text("strongs_id").notNull(),
    note: text("note").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  t => [primaryKey({ columns: [t.userId, t.strongsId] })],
);

/** Per-user settings (key/value), e.g. the book chosen in the header. */
export const userSettings = sqliteTable(
  "user_settings",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  t => [primaryKey({ columns: [t.userId, t.key] })],
);

// ---------------------------------------------------------------------------
// Accounts: username + passkeys (WebAuthn), invitation-only sign-up.

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // random UUID; also the WebAuthn user handle
    username: text("username").notNull(), // lowercase, unique
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  t => [uniqueIndex("users_username_idx").on(t.username)],
);

/** WebAuthn credentials. One user can have several (one per device / passkey provider). */
export const passkeys = sqliteTable(
  "passkeys",
  {
    id: text("id").primaryKey(), // credential ID (base64url)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // COSE public key (base64url)
    counter: integer("counter").notNull().default(0),
    transports: text("transports"), // JSON array
    deviceName: text("device_name"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
  },
  t => [index("passkeys_user_idx").on(t.userId)],
);

/** Login sessions. Only a SHA-256 hash of the cookie token is stored. */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  t => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Single-use links: "invite" creates a new account, "device" adds a passkey to an existing one
 * (shown as a QR code on a signed-in device). Only a hash of the token is stored.
 */
export const authTokens = sqliteTable("auth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  kind: text("kind", { enum: ["invite", "device"] }).notNull(),
  userId: text("user_id"), // device: the account to extend
  grantsAdmin: integer("grants_admin", { mode: "boolean" }).notNull().default(false), // invite only
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/** Pending WebAuthn ceremonies (challenge + context), consumed on verification. */
export const authChallenges = sqliteTable("auth_challenges", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["register", "login"] }).notNull(),
  challenge: text("challenge").notNull(),
  userId: text("user_id"),
  data: text("data"), // JSON: username, token hash, …
  expiresAt: text("expires_at").notNull(),
});

