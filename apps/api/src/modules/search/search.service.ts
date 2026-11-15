import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeUsername,
  type ResolvedPerson,
  type SearchResult,
  type SearchResults,
  usernameProblem,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ENGINE, type Engine } from '../compatibility/engine.js';
import { PeopleService } from '../compatibility/people.service.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { escapeLike, rankScore, searchTerms } from './search-text.js';

/** Candidates the database returns before visibility rules and re-ranking. */
const CANDIDATES = 40;
/** Below this a match is a coincidence of letters (about 0.4 trigram similarity). */
const MIN_SCORE = 150;
const NOT_FOUND = 'Not found.';

interface Candidate {
  id: string;
  score: number;
  matched_on: 'username' | 'name';
}

/**
 * People search by username or name.
 *
 * Retrieval is in SQL: exact and prefix username matches, word-prefix and
 * substring name matches, and typo-tolerant trigram matches, each scored by
 * tier. The result is then narrowed with the same visibility rule as a profile
 * view, so search never shows anyone a profile would hide, and re-ranked with
 * closeness to the searcher (see `rankScore`).
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly media: MediaUrlService,
    @Inject(ENGINE) private readonly engine: Engine,
  ) {}

  async search(viewerId: string, query: string, limit: number): Promise<SearchResults> {
    const { name, handle } = searchTerms(query);
    if (name.length < 2) return { results: [] };

    const nameExact = name;
    const namePrefix = `${escapeLike(name)}%`;
    const nameWord = `% ${escapeLike(name)}%`;
    const nameContains = `%${escapeLike(name)}%`;
    const handlePrefix = `${escapeLike(handle)}%`;
    const handleContains = `%${escapeLike(handle)}%`;
    const hasHandle = handle.length >= 2;

    const rows = await this.prisma.$queryRaw<Candidate[]>(Prisma.sql`
      WITH scored AS (
        SELECT
          u.id,
          CASE WHEN ${hasHandle} AND p.username IS NOT NULL THEN GREATEST(
            CASE WHEN p.username = ${handle} THEN 1000 ELSE 0 END,
            CASE WHEN p.username LIKE ${handlePrefix} ESCAPE '\\'
                 THEN 800 - LEAST(char_length(p.username) - ${handle.length}, 40) ELSE 0 END,
            CASE WHEN p.username LIKE ${handleContains} ESCAPE '\\' THEN 500 ELSE 0 END,
            (similarity(p.username, ${handle}) * 400)::int
          ) ELSE 0 END AS username_score,
          GREATEST(
            CASE WHEN vyra_fold(p.display_name) = ${nameExact} THEN 780 ELSE 0 END,
            CASE WHEN vyra_fold(p.display_name) LIKE ${namePrefix} ESCAPE '\\' THEN 720 ELSE 0 END,
            CASE WHEN (' ' || vyra_fold(p.display_name)) LIKE ${nameWord} ESCAPE '\\' THEN 680 ELSE 0 END,
            CASE WHEN vyra_fold(p.display_name) LIKE ${nameContains} ESCAPE '\\' THEN 450 ELSE 0 END,
            (word_similarity(${name}, vyra_fold(p.display_name)) * 380)::int
          ) AS name_score,
          char_length(coalesce(p.username, p.display_name)) AS length
        FROM user_profiles p
        JOIN users u ON u.id = p.user_id
        WHERE u.deleted_at IS NULL
          AND u.status IN ('ACTIVE', 'PAUSED')
          AND u.id <> ${viewerId}::uuid
          AND (
            (${hasHandle} AND p.username IS NOT NULL AND (
              p.username LIKE ${handleContains} ESCAPE '\\' OR p.username % ${handle}
            ))
            OR vyra_fold(p.display_name) LIKE ${nameContains} ESCAPE '\\'
            OR ${name} <% vyra_fold(p.display_name)
          )
          AND NOT EXISTS (
            SELECT 1 FROM blocked_users b
            WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = u.id)
               OR (b.blocker_id = u.id AND b.blocked_id = ${viewerId}::uuid)
          )
          AND (
            p.is_discoverable
            OR EXISTS (
              SELECT 1 FROM matches m
              WHERE m.ended_at IS NULL
                AND ((m.user_a_id = ${viewerId}::uuid AND m.user_b_id = u.id)
                  OR (m.user_a_id = u.id AND m.user_b_id = ${viewerId}::uuid))
            )
            OR EXISTS (
              SELECT 1 FROM connection_requests cr
              WHERE cr.status = 'PENDING'
                AND ((cr.sender_id = ${viewerId}::uuid AND cr.recipient_id = u.id)
                  OR (cr.sender_id = u.id AND cr.recipient_id = ${viewerId}::uuid))
            )
          )
      )
      SELECT id, GREATEST(username_score, name_score) AS score,
             CASE WHEN username_score >= name_score THEN 'username' ELSE 'name' END AS matched_on
      FROM scored
      WHERE GREATEST(username_score, name_score) >= ${MIN_SCORE}
      ORDER BY score DESC, length ASC, id
      LIMIT ${CANDIDATES}`);
    if (rows.length === 0) return { results: [] };

    const ids = rows.map((row) => row.id);
    const [loaded, relations, profiles] = await Promise.all([
      this.people.load([viewerId, ...ids]),
      this.relations(viewerId, ids),
      this.prisma.userProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, username: true },
      }),
    ]);
    const viewer = loaded.get(viewerId);
    if (!viewer) return { results: [] };
    const usernames = new Map(profiles.map((profile) => [profile.userId, profile.username]));

    const ranked: { score: number; result: SearchResult }[] = [];
    for (const row of rows) {
      const target = loaded.get(row.id);
      if (!target?.reachable) continue;
      const relation = relations.get(row.id) ?? 'none';
      // The same rule as opening a profile: recommendable both ways, or already tied.
      const shown =
        (target.eligible && this.engine.ineligibility(viewer.person, target.person) === null) ||
        relation !== 'none';
      if (!shown) continue;
      ranked.push({
        score: rankScore({
          base: Number(row.score),
          relation,
          sameCity: viewer.city !== null && viewer.city === target.city,
          hasPhoto: target.photoKey !== null,
        }),
        result: {
          userId: row.id,
          username: usernames.get(row.id) ?? null,
          displayName: target.displayName,
          age: target.person.age,
          city: target.city,
          photoUrl:
            target.eligible && target.photoKey
              ? this.media.sign(target.thumbKey ?? target.photoKey, 'public')
              : null,
          relation,
          matchedOn: row.matched_on,
        },
      });
    }
    ranked.sort((a, b) => b.score - a.score);
    return { results: ranked.slice(0, limit).map((entry) => entry.result) };
  }

  /** Active connections and pending requests between the viewer and each person. */
  private async relations(
    viewerId: string,
    ids: readonly string[],
  ): Promise<Map<string, SearchResult['relation']>> {
    const [matches, requests] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          endedAt: null,
          OR: [
            { userAId: viewerId, userBId: { in: [...ids] } },
            { userBId: viewerId, userAId: { in: [...ids] } },
          ],
        },
        select: { userAId: true, userBId: true },
      }),
      this.prisma.connectionRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { senderId: viewerId, recipientId: { in: [...ids] } },
            { recipientId: viewerId, senderId: { in: [...ids] } },
          ],
        },
        select: { senderId: true, recipientId: true },
      }),
    ]);
    const result = new Map<string, SearchResult['relation']>();
    for (const request of requests) {
      result.set(request.senderId === viewerId ? request.recipientId : request.senderId, 'pending');
    }
    for (const match of matches) {
      result.set(match.userAId === viewerId ? match.userBId : match.userAId, 'connected');
    }
    return result;
  }

  /**
   * "Who is @name?" for opening a shared profile. The answer follows the same
   * visibility rule as a profile view, and a miss never says why.
   */
  async resolve(viewerId: string, rawUsername: string): Promise<ResolvedPerson> {
    const username = normalizeUsername(rawUsername);
    if (usernameProblem(username) !== null) throw new NotFoundException(NOT_FOUND);
    const profile = await this.prisma.userProfile.findFirst({
      where: { username },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(NOT_FOUND);
    const pair = await this.people.visiblePair(viewerId, profile.userId);
    if (!pair) throw new NotFoundException(NOT_FOUND);
    return { userId: profile.userId };
  }
}
