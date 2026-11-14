-- pgvector powers persona embedding similarity search.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'AI_PERSONA_PROCESSING', 'AI_IMPORT_PROCESSING', 'PHOTO_ANALYSIS', 'ASTROLOGY', 'WINGMAN_MESSAGE_CONTEXT', 'ANALYTICS', 'MARKETING');

-- CreateEnum
CREATE TYPE "PhotoModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterestSource" AS ENUM ('USER_SELECTED', 'IMPORT_APPROVED', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "RelationshipIntentKind" AS ENUM ('SERIOUS', 'CASUAL', 'EXPLORING', 'COMPANIONSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonaVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('OBSERVED', 'INFERRED', 'USER_STATED');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('PROFILE', 'PHOTO', 'CHATGPT_IMPORT', 'GEMINI_IMPORT', 'INTEREST_SELECTION', 'INTEGRATION', 'USER_CORRECTION');

-- CreateEnum
CREATE TYPE "ImportProvider" AS ENUM ('CHATGPT', 'GEMINI');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'PROCESSING', 'AWAITING_APPROVAL', 'COMPLETED', 'REJECTED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "DataSufficiency" AS ENUM ('INSUFFICIENT', 'PARTIAL', 'SUFFICIENT');

-- CreateEnum
CREATE TYPE "DiscoveryEventType" AS ENUM ('IMPRESSION', 'PROFILE_OPENED', 'COMPATIBILITY_VIEWED', 'SAVED', 'UNSAVED', 'PASSED', 'CONNECT_REQUESTED', 'CONNECTION_ACCEPTED', 'CONNECTION_DECLINED', 'FIRST_MESSAGE', 'CONVERSATION_SUSTAINED', 'FEEDBACK_SUBMITTED');

-- CreateEnum
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'IMAGE', 'VOICE', 'DATE_PLAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('COMPATIBILITY_ACCURACY', 'RECOMMENDATION_QUALITY', 'PERSONA_ACCURACY', 'CONNECTION_OUTCOME', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'UNDERAGE', 'SPAM_OR_SCAM', 'OFFLINE_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('PHOTO_APPROVED', 'PHOTO_REJECTED', 'PROFILE_HIDDEN', 'PROFILE_RESTORED', 'WARNING_ISSUED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REINSTATED', 'ACCOUNT_BANNED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ONBOARDING',
    "date_of_birth" DATE,
    "age_verified_at" TIMESTAMPTZ(3),
    "last_active_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "destination_hash" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "policy_version" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(60) NOT NULL,
    "bio" VARCHAR(600),
    "gender" VARCHAR(40),
    "pronouns" VARCHAR(40),
    "occupation" VARCHAR(80),
    "city" VARCHAR(80),
    "country_code" CHAR(2),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "onboarding_step" VARCHAR(40),
    "is_discoverable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "perceptual_hash" VARCHAR(32),
    "moderation_status" "PhotoModerationStatus" NOT NULL DEFAULT 'PENDING',
    "assessment" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "user_id" UUID NOT NULL,
    "interest_id" UUID NOT NULL,
    "source" "InterestSource" NOT NULL DEFAULT 'USER_SELECTED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("user_id","interest_id")
);

-- CreateTable
CREATE TABLE "relationship_intents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "RelationshipIntentKind" NOT NULL,
    "custom_label" VARCHAR(60),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_preferences" (
    "user_id" UUID NOT NULL,
    "min_age" INTEGER NOT NULL DEFAULT 18,
    "max_age" INTEGER NOT NULL DEFAULT 40,
    "max_distance_km" INTEGER,
    "interested_in" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deal_breakers" JSONB NOT NULL DEFAULT '[]',
    "show_astrology" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "discovery_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_versions" (
    "id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "schema_version" VARCHAR(20) NOT NULL,
    "status" "PersonaVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "attributes" JSONB NOT NULL,
    "generated_by" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "persona_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_evidence" (
    "id" UUID NOT NULL,
    "persona_version_id" UUID NOT NULL,
    "attribute_key" VARCHAR(80) NOT NULL,
    "category" "EvidenceCategory" NOT NULL,
    "source_type" "EvidenceSourceType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "import_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_imports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "ImportProvider" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "storage_key" TEXT,
    "size_bytes" BIGINT NOT NULL,
    "failure_code" VARCHAR(60),
    "raw_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "raw_deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_weight_sets" (
    "version" VARCHAR(40) NOT NULL,
    "weights" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(400),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compatibility_weight_sets_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "compatibility_scores" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "persona_version_a_id" UUID NOT NULL,
    "persona_version_b_id" UUID NOT NULL,
    "weights_version" VARCHAR(40) NOT NULL,
    "engine_version" VARCHAR(20) NOT NULL,
    "overall" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sufficiency" "DataSufficiency" NOT NULL,
    "dimensions" JSONB NOT NULL,
    "blocked_reason" VARCHAR(80),
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compatibility_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_scenarios" (
    "id" UUID NOT NULL,
    "score_id" UUID NOT NULL,
    "scenario_key" VARCHAR(40) NOT NULL,
    "alignment" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" JSONB NOT NULL,

    CONSTRAINT "compatibility_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_user_id" UUID,
    "type" "DiscoveryEventType" NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_profiles" (
    "user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_profiles_pkey" PRIMARY KEY ("user_id","target_user_id")
);

-- CreateTable
CREATE TABLE "connection_requests" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "status" "ConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "connection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "connection_request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(3),
    "sends_read_receipts" BOOLEAN NOT NULL DEFAULT true,
    "wingman_context_enabled" BOOLEAN NOT NULL DEFAULT false,
    "muted_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" VARCHAR(4000),
    "media_key" TEXT,
    "payload" JSONB,
    "ai_assisted" BOOLEAN NOT NULL DEFAULT false,
    "client_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trends" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "momentum" DOUBLE PRECISION NOT NULL,
    "region_code" CHAR(2),
    "interest_id" UUID,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrology_profiles" (
    "user_id" UUID NOT NULL,
    "birth_date" DATE NOT NULL,
    "birth_time" CHAR(5),
    "birth_place" VARCHAR(120),
    "birth_latitude" DOUBLE PRECISION,
    "birth_longitude" DOUBLE PRECISION,
    "birth_time_zone" VARCHAR(60),
    "chart" JSONB,
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "astrology_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(40) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "provider_reference" TEXT NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_user_id" UUID,
    "kind" "FeedbackKind" NOT NULL,
    "rating" INTEGER,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID,
    "reported_user_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(2000),
    "message_id" UUID,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" UUID,
    "resolution_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "safety_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "moderation_events" (
    "id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "ModerationAction" NOT NULL,
    "target_type" VARCHAR(40),
    "target_id" UUID,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "otp_challenges_destination_hash_created_at_idx" ON "otp_challenges"("destination_hash", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_consents_user_id_type_idx" ON "user_consents"("user_id", "type");

-- CreateIndex
CREATE INDEX "user_profiles_is_discoverable_country_code_idx" ON "user_profiles"("is_discoverable", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_photos_storage_key_key" ON "user_photos"("storage_key");

-- CreateIndex
CREATE INDEX "user_photos_user_id_position_idx" ON "user_photos"("user_id", "position");

-- CreateIndex
CREATE INDEX "user_photos_user_id_content_hash_idx" ON "user_photos"("user_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "interests_slug_key" ON "interests"("slug");

-- CreateIndex
CREATE INDEX "interests_category_idx" ON "interests"("category");

-- CreateIndex
CREATE INDEX "user_interests_interest_id_idx" ON "user_interests"("interest_id");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_intents_user_id_kind_key" ON "relationship_intents"("user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "personas_user_id_key" ON "personas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "personas_current_version_id_key" ON "personas"("current_version_id");

-- CreateIndex
CREATE INDEX "persona_versions_persona_id_status_idx" ON "persona_versions"("persona_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "persona_versions_persona_id_version_key" ON "persona_versions"("persona_id", "version");

-- CreateIndex
CREATE INDEX "persona_evidence_persona_version_id_attribute_key_idx" ON "persona_evidence"("persona_version_id", "attribute_key");

-- CreateIndex
CREATE INDEX "ai_imports_user_id_created_at_idx" ON "ai_imports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_imports_status_idx" ON "ai_imports"("status");

-- CreateIndex
CREATE INDEX "ai_imports_raw_expires_at_idx" ON "ai_imports"("raw_expires_at");

-- CreateIndex
CREATE INDEX "compatibility_scores_user_a_id_overall_idx" ON "compatibility_scores"("user_a_id", "overall");

-- CreateIndex
CREATE INDEX "compatibility_scores_user_b_id_overall_idx" ON "compatibility_scores"("user_b_id", "overall");

-- CreateIndex
CREATE INDEX "compatibility_scores_persona_version_b_id_idx" ON "compatibility_scores"("persona_version_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_scores_persona_version_a_id_persona_version_b_key" ON "compatibility_scores"("persona_version_a_id", "persona_version_b_id", "weights_version", "engine_version");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_scenarios_score_id_scenario_key_key" ON "compatibility_scenarios"("score_id", "scenario_key");

-- CreateIndex
CREATE INDEX "discovery_events_user_id_created_at_idx" ON "discovery_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "discovery_events_user_id_target_user_id_type_idx" ON "discovery_events"("user_id", "target_user_id", "type");

-- CreateIndex
CREATE INDEX "discovery_events_type_created_at_idx" ON "discovery_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "saved_profiles_target_user_id_idx" ON "saved_profiles"("target_user_id");

-- CreateIndex
CREATE INDEX "connection_requests_recipient_id_status_idx" ON "connection_requests"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "connection_requests_sender_id_status_idx" ON "connection_requests"("sender_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connection_requests_sender_id_recipient_id_key" ON "connection_requests"("sender_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_connection_request_id_key" ON "matches"("connection_request_id");

-- CreateIndex
CREATE INDEX "matches_user_b_id_idx" ON "matches"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_user_a_id_user_b_id_key" ON "matches"("user_a_id", "user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_match_id_key" ON "conversations"("match_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_client_id_key" ON "messages"("conversation_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "trends_slug_key" ON "trends"("slug");

-- CreateIndex
CREATE INDEX "trends_category_expires_at_idx" ON "trends"("category", "expires_at");

-- CreateIndex
CREATE INDEX "trends_interest_id_idx" ON "trends"("interest_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_provider_reference_key" ON "subscriptions"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "user_feedback_user_id_created_at_idx" ON "user_feedback"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_feedback_kind_created_at_idx" ON "user_feedback"("kind", "created_at");

-- CreateIndex
CREATE INDEX "safety_reports_status_created_at_idx" ON "safety_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "safety_reports_reported_user_id_idx" ON "safety_reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "blocked_users_blocked_id_idx" ON "blocked_users"("blocked_id");

-- CreateIndex
CREATE INDEX "moderation_events_subject_user_id_created_at_idx" ON "moderation_events"("subject_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_intents" ADD CONSTRAINT "relationship_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "persona_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_evidence" ADD CONSTRAINT "persona_evidence_persona_version_id_fkey" FOREIGN KEY ("persona_version_id") REFERENCES "persona_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_evidence" ADD CONSTRAINT "persona_evidence_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "ai_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_imports" ADD CONSTRAINT "ai_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_persona_version_a_id_fkey" FOREIGN KEY ("persona_version_a_id") REFERENCES "persona_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_persona_version_b_id_fkey" FOREIGN KEY ("persona_version_b_id") REFERENCES "persona_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_weights_version_fkey" FOREIGN KEY ("weights_version") REFERENCES "compatibility_weight_sets"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scenarios" ADD CONSTRAINT "compatibility_scenarios_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "compatibility_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_events" ADD CONSTRAINT "discovery_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_events" ADD CONSTRAINT "discovery_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_profiles" ADD CONSTRAINT "saved_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_profiles" ADD CONSTRAINT "saved_profiles_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_connection_request_id_fkey" FOREIGN KEY ("connection_request_id") REFERENCES "connection_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trends" ADD CONSTRAINT "trends_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrology_profiles" ADD CONSTRAINT "astrology_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Constraints Prisma's schema language cannot express ─────────────

-- A user must be reachable by at least one verified channel until deleted.
ALTER TABLE "users" ADD CONSTRAINT "users_contact_present"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL OR "deleted_at" IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase"
  CHECK ("email" IS NULL OR "email" = lower("email"));

ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_attempts_nonnegative"
  CHECK ("attempts" >= 0);

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_latitude_range"
  CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_longitude_range"
  CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_coordinates_paired"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_position_range"
  CHECK ("position" BETWEEN 0 AND 8);
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_dimensions_positive"
  CHECK ("width" > 0 AND "height" > 0 AND "size_bytes" > 0);
-- One live photo per slot.
CREATE UNIQUE INDEX "user_photos_user_position_live_key"
  ON "user_photos" ("user_id", "position") WHERE "deleted_at" IS NULL;

ALTER TABLE "relationship_intents" ADD CONSTRAINT "relationship_intents_other_needs_label"
  CHECK (("kind" = 'OTHER') = ("custom_label" IS NOT NULL));
CREATE UNIQUE INDEX "relationship_intents_one_primary_key"
  ON "relationship_intents" ("user_id") WHERE "is_primary";

ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_age_range"
  CHECK ("min_age" >= 18 AND "max_age" >= "min_age" AND "max_age" <= 120);
ALTER TABLE "discovery_preferences" ADD CONSTRAINT "discovery_preferences_distance_positive"
  CHECK ("max_distance_km" IS NULL OR "max_distance_km" > 0);

ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_version_positive"
  CHECK ("version" > 0);
ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_approval_consistent"
  CHECK ("status" <> 'APPROVED' OR "approved_at" IS NOT NULL);
ALTER TABLE "persona_evidence" ADD CONSTRAINT "persona_evidence_confidence_range"
  CHECK ("confidence" BETWEEN 0 AND 1);

ALTER TABLE "ai_imports" ADD CONSTRAINT "ai_imports_size_positive"
  CHECK ("size_bytes" > 0);
-- Once raw data is marked deleted the storage key must be gone too.
ALTER TABLE "ai_imports" ADD CONSTRAINT "ai_imports_raw_deletion_consistent"
  CHECK ("raw_deleted_at" IS NULL OR "storage_key" IS NULL);

CREATE UNIQUE INDEX "compatibility_weight_sets_one_active_key"
  ON "compatibility_weight_sets" ("is_active") WHERE "is_active";

ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_pair_ordered"
  CHECK ("user_a_id" < "user_b_id");
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_overall_range"
  CHECK ("overall" IS NULL OR ("overall" BETWEEN 0 AND 1));
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_confidence_range"
  CHECK ("confidence" BETWEEN 0 AND 1);
-- Insufficient data never carries a headline number.
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_insufficient_has_no_score"
  CHECK ("sufficiency" <> 'INSUFFICIENT' OR "overall" IS NULL);
ALTER TABLE "compatibility_scenarios" ADD CONSTRAINT "compatibility_scenarios_alignment_range"
  CHECK ("alignment" IS NULL OR ("alignment" BETWEEN 0 AND 1));
ALTER TABLE "compatibility_scenarios" ADD CONSTRAINT "compatibility_scenarios_confidence_range"
  CHECK ("confidence" BETWEEN 0 AND 1);

ALTER TABLE "discovery_events" ADD CONSTRAINT "discovery_events_not_self"
  CHECK ("target_user_id" IS NULL OR "target_user_id" <> "user_id");
ALTER TABLE "saved_profiles" ADD CONSTRAINT "saved_profiles_not_self"
  CHECK ("user_id" <> "target_user_id");
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_not_self"
  CHECK ("sender_id" <> "recipient_id");
ALTER TABLE "matches" ADD CONSTRAINT "matches_pair_ordered"
  CHECK ("user_a_id" < "user_b_id");
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_not_self"
  CHECK ("blocker_id" <> "blocked_id");
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_not_self"
  CHECK ("reporter_id" IS NULL OR "reporter_id" <> "reported_user_id");

-- A message carries text, media or a structured payload.
ALTER TABLE "messages" ADD CONSTRAINT "messages_has_content"
  CHECK ("body" IS NOT NULL OR "media_key" IS NOT NULL OR "payload" IS NOT NULL OR "deleted_at" IS NOT NULL);

ALTER TABLE "trends" ADD CONSTRAINT "trends_momentum_range"
  CHECK ("momentum" BETWEEN 0 AND 1);
ALTER TABLE "trends" ADD CONSTRAINT "trends_window_valid"
  CHECK ("expires_at" > "observed_at");

ALTER TABLE "astrology_profiles" ADD CONSTRAINT "astrology_profiles_birth_time_format"
  CHECK ("birth_time" IS NULL OR "birth_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_period_valid"
  CHECK ("current_period_end" > "current_period_start");
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_rating_range"
  CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));

-- Persona embeddings: kept outside the Prisma-managed "public" schema.
CREATE SCHEMA "vyra_vector";
CREATE TABLE "vyra_vector"."persona_embeddings" (
  "persona_version_id" UUID PRIMARY KEY
    REFERENCES "public"."persona_versions" ("id") ON DELETE CASCADE,
  "model" VARCHAR(80) NOT NULL,
  "embedding" vector(768) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Approximate nearest-neighbour search (cosine distance).
CREATE INDEX "persona_embeddings_embedding_hnsw_idx"
  ON "vyra_vector"."persona_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- Seed the initial weight hypothesis (see docs/COMPATIBILITY_ENGINE.md).
INSERT INTO "compatibility_weight_sets" ("version", "weights", "is_active", "notes")
VALUES (
  '2026-11-v1',
  '{"emotional":0.25,"communication":0.2,"lifestyle":0.15,"relationshipAlignment":0.2,"intellectual":0.1,"mutualPreferences":0.1}',
  true,
  'Initial product hypothesis. Not empirically validated.'
);
