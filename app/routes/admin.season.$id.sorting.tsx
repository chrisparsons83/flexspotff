import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { EmbedBuilder } from 'discord.js';
import { useState, useEffect } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { z } from 'zod';
import { sendMessageToChannel, setUserRole } from '~/../bot/utils';
import LocalDateTime from '~/components/ui/LocalDateTime';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { getDraftSlotsBySeason } from '~/models/draftSlot.server';
import { getDraftSlotPreferencesByUser } from '~/models/draftSlotPreference.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getRegistrationsByYear } from '~/models/registration.server';
import { getSeasonById } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { SERVER_DISCORD_ID } from '~/utils/constants';
import { envSchema, shuffleArray } from '~/utils/helpers';

type PlayerTier = 'champions' | 'tier2';

interface AnnouncementPlayer {
  id: string;
  discordName: string;
  discordId: string;
}

interface AnnouncementPayload {
  groups: AnnouncementGroup[];
  champions: AnnouncementPlayer[];
}

interface AnnouncementDraftSlot {
  id: string;
  draftDateTime: string;
  season: number;
}

interface AnnouncementGroup {
  leagueId: string;
  leagueName: string;
  draftSlot: AnnouncementDraftSlot;
  players: AnnouncementPlayer[];
}

interface LeagueGroups {
  [leagueName: string]: AnnouncementGroup[];
}

interface CompletedGroup {
  draftSlot: {
    id: string;
    draftDateTime: Date;
    season: number;
  };
  players: Array<{
    id: string;
    discordName: string;
    discordId: string;
  }>;
}

interface SortingResultData {
  completedGroups: Array<{
    draftSlot: {
      id: string;
      draftDateTime: Date;
      season: number;
    };
    players: Array<{
      id: string;
      discordName: string;
      discordId: string;
    }>;
  }>;
  ungroupedPlayers: Array<{
    id: string;
    discordName: string;
    bestSlot?: {
      id: string;
      draftDateTime: Date;
    };
  }>;
  slotAvailabilityAnalysis: Array<{
    draftSlot: {
      id: string;
      draftDateTime: Date;
      season: number;
    };
    unavailablePlayers: Array<{
      id: string;
      discordName: string;
    }>;
    availablePlayerCount: number;
  }>;
}

interface ChampionsSlotOption {
  draftSlot: {
    id: string;
    draftDateTime: Date;
    season: number;
  };
  availableCount: number;
  unavailablePlayers: Array<{
    id: string;
    discordName: string;
  }>;
  usedByGroup: boolean;
}

interface PlayerPreferences {
  [playerId: string]: Array<{
    draftSlotId: string;
    draftDateTime?: Date;
  }>;
}

// Zod schemas for announcement data validation
const AnnouncementPlayerSchema = z.object({
  id: z.string(),
  discordName: z.string(),
  discordId: z.string(),
});

const AnnouncementDraftSlotSchema = z.object({
  id: z.string(),
  draftDateTime: z.string(),
  season: z.number(),
});

const AnnouncementGroupSchema = z.object({
  // leagueId is the identity used for duplicate checks; League.name has no
  // unique constraint, so names are display/role-lookup only.
  leagueId: z.string(),
  leagueName: z.string(),
  draftSlot: AnnouncementDraftSlotSchema,
  players: z.array(AnnouncementPlayerSchema),
});

// Champions are carried alongside the sorted groups so they can be given their
// role. They are deliberately not rendered into any embed.
const AnnouncementDataSchema = z.object({
  groups: z.array(AnnouncementGroupSchema),
  champions: z.array(AnnouncementPlayerSchema),
});

const env = envSchema.parse(process.env);

// Every league drafts with exactly 12 players, including Champions.
const GROUP_SIZE = 12;

// Lowercased League.name of the tier-1 league, which is never sorted into a
// draft slot -- its members are the players held out of the sort.
const CHAMPIONS_LEAGUE = 'champions';

// The slot search is C(slots, groups) and runs synchronously, so it blocks the
// event loop for its whole duration. Measured against real season data, a
// combination costs ~40us to solve, and the worst case (no arrangement exists,
// so every combination is evaluated) is ~0.6s at this ceiling.
const MAX_SLOT_COMBINATIONS = 15_000;

// How many role assignments are in flight at once. The shared REST client in
// bot/utils.ts queues and retries around Discord's rate limits on its own, so
// this only needs to keep the request from taking minutes.
const ROLE_ASSIGNMENT_CONCURRENCY = 5;

// League.name is stored capitalized ("Admiral"), so keys are lowercased on
// lookup -- same convention as leagueColors below.
const leagueRoleIds: Record<string, string | undefined> = {
  admiral: env.ADMIRAL_ROLE_ID,
  champions: env.CHAMPIONS_ROLE_ID,
  dragon: env.DRAGON_ROLE_ID,
  galaxy: env.GALAXY_ROLE_ID,
  monarch: env.MONARCH_ROLE_ID,
};

interface RoleAssignmentTarget {
  player: AnnouncementPlayer;
  leagueName: string;
}

interface RoleAssignmentFailure {
  discordName: string;
  leagueName: string;
  reason: string;
}

function isRoleAssignmentFailure(
  value: unknown,
): value is RoleAssignmentFailure {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.discordName === 'string' &&
    typeof candidate.leagueName === 'string' &&
    typeof candidate.reason === 'string'
  );
}

/**
 * Pulls role-assignment failures out of the action response. The action returns
 * several different shapes, so this checks rather than asserts.
 */
function getRoleFailures(actionData: unknown): RoleAssignmentFailure[] {
  if (!actionData || typeof actionData !== 'object') return [];
  if (!('roleFailures' in actionData)) return [];

  const { roleFailures } = actionData as { roleFailures: unknown };
  if (!Array.isArray(roleFailures)) return [];

  return roleFailures.filter(isRoleAssignmentFailure);
}

/**
 * Pulls the group-index -> league-id mapping out of the action response. Like
 * getRoleFailures, this checks rather than asserts, because the action returns
 * several different shapes and `in` narrowing widens them to `{}`.
 */
function getLeagueAssignments(actionData: unknown): Record<number, string> {
  if (!actionData || typeof actionData !== 'object') return {};
  if (!('leagueAssignments' in actionData)) return {};

  const { leagueAssignments } = actionData as { leagueAssignments: unknown };
  if (!leagueAssignments || typeof leagueAssignments !== 'object') return {};

  const result: Record<number, string> = {};
  for (const [key, value] of Object.entries(leagueAssignments)) {
    const index = Number(key);
    if (Number.isInteger(index) && typeof value === 'string') {
      result[index] = value;
    }
  }
  return result;
}

/**
 * Ranks every draft slot by how many Champions could attend it. Champions are
 * held out of the slot sort, so this is the only guidance the admin gets for
 * picking their draft time.
 */
function buildChampionsSlotOptions({
  champions,
  draftSlots,
  preferencesByUser,
  usedSlotIds,
}: {
  champions: Array<{ id: string; discordName: string }>;
  draftSlots: Array<{ id: string; draftDateTime: Date; season: number }>;
  preferencesByUser: Map<string, Array<{ draftSlotId: string }>>;
  usedSlotIds: Set<string>;
}): ChampionsSlotOption[] {
  const availabilityByChampion = new Map<string, Set<string>>(
    champions.map(champion => {
      const preferences = preferencesByUser.get(champion.id);
      return [
        champion.id,
        // No preferences recorded means available for anything, matching how
        // the sorter treats preference-less players.
        preferences?.length
          ? new Set(preferences.map(p => p.draftSlotId))
          : new Set(draftSlots.map(slot => slot.id)),
      ];
    }),
  );

  return draftSlots
    .map(slot => {
      const unavailablePlayers = champions.filter(
        champion => !availabilityByChampion.get(champion.id)?.has(slot.id),
      );
      return {
        draftSlot: slot,
        availableCount: champions.length - unavailablePlayers.length,
        unavailablePlayers: unavailablePlayers.map(champion => ({
          id: champion.id,
          discordName: champion.discordName,
        })),
        usedByGroup: usedSlotIds.has(slot.id),
      };
    })
    .sort(
      (a, b) =>
        b.availableCount - a.availableCount ||
        a.draftSlot.draftDateTime.getTime() -
          b.draftSlot.draftDateTime.getTime(),
    );
}

/**
 * Assigns one player their league's Discord role. Never throws -- a failure for
 * one player must not stop the rest, so problems come back to be fixed by hand.
 */
async function assignLeagueRole({
  player,
  leagueName,
}: RoleAssignmentTarget): Promise<RoleAssignmentFailure | null> {
  const roleId = leagueRoleIds[leagueName.toLowerCase()];

  if (!roleId) {
    return {
      discordName: player.discordName,
      leagueName,
      reason: `No role ID configured for ${leagueName} (set ${leagueName.toUpperCase()}_ROLE_ID).`,
    };
  }

  if (!player.discordId) {
    return {
      discordName: player.discordName,
      leagueName,
      reason: 'Player has no Discord ID on file.',
    };
  }

  try {
    await setUserRole({
      guildId: SERVER_DISCORD_ID,
      userId: player.discordId,
      roleId,
    });
    return null;
  } catch (error) {
    return {
      discordName: player.discordName,
      leagueName,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Assigns every player their league role, a few at a time. Returns the ones
 * that failed so the admin can apply those by hand.
 */
async function assignLeagueRoles(
  targets: RoleAssignmentTarget[],
): Promise<RoleAssignmentFailure[]> {
  const failures: RoleAssignmentFailure[] = [];

  for (
    let index = 0;
    index < targets.length;
    index += ROLE_ASSIGNMENT_CONCURRENCY
  ) {
    const batch = targets.slice(index, index + ROLE_ASSIGNMENT_CONCURRENCY);
    const results = await Promise.all(batch.map(assignLeagueRole));
    failures.push(...results.filter((r): r is RoleAssignmentFailure => !!r));
  }

  return failures;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasonId = params.id;
  if (!seasonId) {
    throw new Error('Season ID is required');
  }

  // Get season by ID
  const season = await getSeasonById(seasonId);
  if (!season) {
    throw new Error('Season not found');
  }

  // Get all registrations for this season
  const registrations = await getRegistrationsByYear(season.year);

  // Get leagues for this season
  const leagues = await getLeaguesByYear(season.year);

  return typedjson({
    season,
    registrations,
    leagues,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  if (actionType === 'sendAnnouncement') {
    const seasonId = params.id;
    if (!seasonId) {
      throw new Error('Season ID is required');
    }

    const season = await getSeasonById(seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    // Get the announcement data from form
    const announcementData = formData.get('announcementData');
    if (
      !announcementData ||
      typeof announcementData !== 'string' ||
      !announcementData.trim()
    ) {
      return typedjson({
        error: 'No announcement data provided.',
      });
    }

    let groupData;
    let champions;
    try {
      const parsedData = JSON.parse(announcementData);
      const validationResult = AnnouncementDataSchema.safeParse(parsedData);

      if (!validationResult.success) {
        console.error(
          'Announcement data validation failed:',
          validationResult.error,
        );
        return typedjson({
          error:
            'Invalid announcement data format. Please check the data structure.',
        });
      }

      groupData = validationResult.data.groups;
      champions = validationResult.data.champions;
    } catch (error) {
      console.error('Error parsing announcement data:', error);
      return typedjson({
        error: 'Failed to parse announcement data. Please try again.',
      });
    }

    // Built before any validation so that every exit below can hand the page
    // its results back. Returning a bare error would unmount the whole sorting
    // view and force a re-sort -- which, since sorting is randomized, would
    // hand back a different grouping than the one being corrected.
    const completedGroups = groupData.map(group => ({
      draftSlot: {
        id: group.draftSlot.id,
        draftDateTime: new Date(group.draftSlot.draftDateTime),
        season: group.draftSlot.season,
      },
      players: group.players.map(player => ({
        id: player.id,
        discordName: player.discordName,
        discordId: player.discordId,
      })),
    }));

    const leagueAssignments: Record<number, string> = {};
    groupData.forEach((group, index) => {
      if (group.leagueId) {
        leagueAssignments[index] = group.leagueId;
      }
    });

    // Recomputed rather than round-tripped through the form, so the Champions
    // panel survives this POST like the rest of the results do.
    const seasonDraftSlots = await getDraftSlotsBySeason({
      seasonId: season.id,
    });
    const preservedState = {
      sortingResult: {
        completedGroups,
        ungroupedPlayers: [], // Empty since all players are in groups for announcement
        slotAvailabilityAnalysis: [], // Empty for announcement
      },
      leagueAssignments,
      champions,
      // Ranking a wrong-sized Champions list would render a meaningless "0/0
      // available" panel, so it is skipped until the count check below passes.
      championsSlotOptions:
        champions.length === GROUP_SIZE
          ? buildChampionsSlotOptions({
              champions,
              draftSlots: seasonDraftSlots.map(slot => ({
                id: slot.id,
                draftDateTime: slot.draftDateTime,
                season: season.year,
              })),
              preferencesByUser: await getDraftSlotPreferencesByUser(
                champions.map(champion => champion.id),
                season.id,
              ),
              usedSlotIds: new Set(
                completedGroups.map(group => group.draftSlot.id),
              ),
            })
          : [],
      playerPreferences: {} as Record<
        string,
        Array<{
          draftSlotId: string;
          draftDateTime: Date;
        }>
      >, // Keep empty for now
    };

    // Champions never appear in an embed, so without this check an empty list
    // would announce cleanly while silently assigning nobody the Champions role.
    if (champions.length !== GROUP_SIZE) {
      return typedjson({
        error: `Expected ${GROUP_SIZE} Champions in the announcement but found ${champions.length}. Re-run the sort before announcing.`,
        ...preservedState,
      });
    }

    // Two groups on one league would give that role to 24 people. Deduplicate on
    // leagueId to match the client -- League.name is not unique.
    const assignedLeagueIds = groupData.map(group => group.leagueId);
    const duplicateIndexes = assignedLeagueIds
      .map((id, index) =>
        assignedLeagueIds.indexOf(id) !== index ? index : -1,
      )
      .filter(index => index !== -1);
    if (duplicateIndexes.length > 0) {
      const duplicatedNames = [
        ...new Set(duplicateIndexes.map(index => groupData[index].leagueName)),
      ];
      return typedjson({
        error: `Each league can only be assigned to one group. Duplicated: ${duplicatedNames.join(
          ', ',
        )}.`,
        ...preservedState,
      });
    }

    // The Champions league is assigned implicitly from the held-out 12, so a
    // sorted group must never claim it.
    if (
      groupData.some(
        group => group.leagueName.toLowerCase() === CHAMPIONS_LEAGUE,
      )
    ) {
      return typedjson({
        error:
          'The Champions league is assigned automatically to the 12 held-out players. Pick a different league for that group.',
        ...preservedState,
      });
    }

    // Group by league name
    const leagueGroups = groupData.reduce<LeagueGroups>((acc, group) => {
      const leagueName = group.leagueName;
      if (!acc[leagueName]) {
        acc[leagueName] = [];
      }
      acc[leagueName].push(group);
      return acc;
    }, {});

    // Sort league names alphabetically
    const sortedLeagueNames = Object.keys(leagueGroups).sort((a, b) =>
      a.localeCompare(b),
    );

    // Create separate embeds for each league in alphabetical order
    const embeds: EmbedBuilder[] = [];

    const leagueColors: Record<string, number> = {
      admiral: 0x15c9bf,
      champions: 0xc29f04,
      dragon: 0x1f8b4c,
      galaxy: 0x3498db,
      monarch: 0xab59b6,
    };

    sortedLeagueNames.forEach(leagueName => {
      const groups = leagueGroups[leagueName];
      const embed = new EmbedBuilder()
        .setTitle(`🏈 ${leagueName} League ${season.year}`)
        .setColor(leagueColors[leagueName.toLowerCase()] || 0x00ff00);

      groups.forEach((group: AnnouncementGroup) => {
        const playerList = group.players
          .map((p: AnnouncementPlayer) => `• ${p.discordName}`)
          .join('\n');
        const draftTime =
          new Date(group.draftSlot.draftDateTime).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) +
          ' at ' +
          new Date(group.draftSlot.draftDateTime).toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          });

        embed.setDescription(`Draft Time: ${draftTime}`);
        embed.setColor(leagueColors[leagueName.toLowerCase()] || 0x00ff00);

        embed.addFields({
          name: `Members`,
          value: playerList,
          inline: false,
        });
      });

      embeds.push(embed);
    });

    if (!env.LEAGUE_ANNOUNCEMENT_CHANNEL_ID) {
      return typedjson({
        error: 'League announcement channel not configured.',
        ...preservedState,
      });
    }

    // Send to Discord first -- roles are only assigned once the announcement
    // itself has landed.
    try {
      console.log(
        'Attempting to send Discord message with embeds:',
        embeds.length,
      );
      await sendMessageToChannel({
        channelId: env.LEAGUE_ANNOUNCEMENT_CHANNEL_ID,
        messageData: {
          embeds: embeds,
        },
      });
      console.log('Discord message sent successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return typedjson({
        error: `Failed to send announcement to Discord: ${errorMessage}. No roles were assigned. Please try again.`,
        ...preservedState,
      });
    }

    // Assign roles. Champions are role-only and never appear in an embed.
    const roleTargets: RoleAssignmentTarget[] = [
      ...groupData.flatMap(group =>
        group.players.map(player => ({
          player,
          leagueName: group.leagueName,
        })),
      ),
      ...champions.map(player => ({
        player,
        leagueName: 'Champions',
      })),
    ];

    const roleFailures = await assignLeagueRoles(roleTargets);

    if (roleFailures.length > 0) {
      return typedjson({
        success: `Announced to Discord. ${
          roleTargets.length - roleFailures.length
        } of ${roleTargets.length} roles assigned.`,
        roleFailures,
        ...preservedState,
      });
    }

    return typedjson({
      success: `Draft group assignments announced to Discord and all ${roleTargets.length} roles assigned!`,
      ...preservedState,
    });
  }

  if (actionType === 'sortPlayers') {
    const seasonId = params.id;
    if (!seasonId) {
      throw new Error('Season ID is required');
    }

    const season = await getSeasonById(seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    const selectedPlayerIds = formData.getAll('tier2Players') as string[];
    const championPlayerIds = formData.getAll('championPlayers') as string[];

    // Champions draft as their own league and are held out of the slot sort,
    // so we need exactly one full Champions group plus whole groups of the rest.
    if (championPlayerIds.length !== GROUP_SIZE) {
      return typedjson({
        error: `Please mark exactly ${GROUP_SIZE} players as Champions (currently ${championPlayerIds.length}).`,
      });
    }

    if (
      selectedPlayerIds.length === 0 ||
      selectedPlayerIds.length % GROUP_SIZE !== 0
    ) {
      return typedjson({
        error: `Tier 2 players must be a non-zero multiple of ${GROUP_SIZE} (currently ${selectedPlayerIds.length}).`,
      });
    }

    try {
      // Get draft slots for this season. Attach the season year so downstream
      // grouping/announcement code can keep displaying it (all slots here
      // belong to the same season).
      const seasonDraftSlots = await getDraftSlotsBySeason({
        seasonId: season.id,
      });
      const draftSlots = seasonDraftSlots.map(slot => ({
        id: slot.id,
        draftDateTime: slot.draftDateTime,
        season: season.year,
      }));

      if (draftSlots.length === 0) {
        return typedjson({
          error:
            'No draft slots found for this season. Please create draft slots first.',
        });
      }

      const targetGroups = selectedPlayerIds.length / GROUP_SIZE;

      if (draftSlots.length < targetGroups) {
        return typedjson({
          error: `Sorting ${selectedPlayerIds.length} players needs ${targetGroups} draft slots, but this season only has ${draftSlots.length}.`,
        });
      }

      // The search walks group counts down from targetGroups, so the worst case
      // is the sum across every size it may try.
      let combinationCount = 0;
      for (let groupCount = targetGroups; groupCount >= 1; groupCount--) {
        combinationCount += countCombinations(draftSlots.length, groupCount);
      }
      if (combinationCount > MAX_SLOT_COMBINATIONS) {
        return typedjson({
          error: `Too many draft slot combinations to search (${combinationCount.toLocaleString()}). Remove some draft slots for this season and try again.`,
        });
      }

      // Get registrations to get player data
      const registrations = await getRegistrationsByYear(season.year);
      const selectedPlayerData = registrations
        .filter(reg => selectedPlayerIds.includes(reg.user.id))
        .map(reg => ({
          id: reg.user.id,
          discordName: reg.user.discordName,
          discordId: reg.user.discordId,
        }));

      // Champions skip the slot sort entirely -- they just carry through so the
      // UI can show them and the announcement can assign their role.
      const championPlayerData = registrations
        .filter(reg => championPlayerIds.includes(reg.user.id))
        .map(reg => ({
          id: reg.user.id,
          discordName: reg.user.discordName,
          discordId: reg.user.discordId,
        }));

      // One query for everyone's preferences instead of one per player.
      const preferencesByUser = await getDraftSlotPreferencesByUser(
        [...selectedPlayerIds, ...championPlayerIds],
        season.id,
      );

      // Separate players with and without preferences
      const playersWithPreferences = [];
      const playersWithoutPreferences = [];

      for (const player of selectedPlayerData) {
        const preferences = preferencesByUser.get(player.id) ?? [];

        if (preferences.length > 0) {
          // Player has selected the times they are available for
          playersWithPreferences.push({
            id: player.id,
            discordName: player.discordName,
            discordId: player.discordId,
            preferences: preferences.map(p => ({
              draftSlotId: p.draftSlotId,
            })),
          });
        } else {
          // Player has no preferences recorded - assume they're available for all slots
          playersWithoutPreferences.push({
            id: player.id,
            discordName: player.discordName,
            discordId: player.discordId,
            allAvailableSlots: draftSlots.map(slot => slot.id), // Available for all slots
          });
        }
      }

      // Implement sorting algorithm
      const result = sortPlayersIntoDraftSlots(
        playersWithPreferences,
        playersWithoutPreferences,
        draftSlots,
        selectedPlayerIds.length,
      );

      const championsSlotOptions = buildChampionsSlotOptions({
        champions: championPlayerData,
        draftSlots,
        preferencesByUser,
        usedSlotIds: new Set(
          result.completedGroups.map(group => group.draftSlot.id),
        ),
      });

      // Create player preferences map for popover data
      const playerPreferencesMap: Record<
        string,
        Array<{
          draftSlotId: string;
          draftDateTime: Date;
        }>
      > = {};

      for (const player of selectedPlayerData) {
        const preferences = preferencesByUser.get(player.id);
        if (preferences?.length) {
          playerPreferencesMap[player.id] = preferences.map(p => ({
            draftSlotId: p.draftSlotId,
            draftDateTime: p.draftSlot.draftDateTime,
          }));
        }
      }

      return typedjson({
        sortingResult: result,
        champions: championPlayerData,
        championsSlotOptions,
        playerPreferences: playerPreferencesMap,
      });
    } catch (error) {
      console.error('Error sorting players:', error);
      return typedjson({
        error: 'An error occurred while sorting players. Please try again.',
      });
    }
  }

  return typedjson({ error: 'Invalid action' });
};

// How many combinations getCombinations would produce, without building them.
function countCombinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}

// Helper function to generate all combinations of k elements from an array
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];

  const result: T[][] = [];

  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

/**
 * Maximum-cardinality assignment of players to slots, respecting each player's
 * allowed slots and a per-slot capacity.
 *
 * This is a max-flow problem (source -> player -> allowed slots -> sink), and
 * solving it exactly matters: a greedy first-fit pass only finds an assignment
 * if players happen to be considered in a workable order, so it can report "no
 * arrangement" for inputs that do have one. Dinic's algorithm always finds a
 * complete assignment when one exists.
 *
 * Returns, per player, the index of their assigned slot, or -1 if unplaceable.
 */
function assignPlayersToSlots(
  playerAllowedSlots: number[][],
  slotCount: number,
  slotCapacity: number,
): number[] {
  const playerCount = playerAllowedSlots.length;
  const source = 0;
  const firstPlayer = 1;
  const firstSlot = firstPlayer + playerCount;
  const sink = firstSlot + slotCount;
  const nodeCount = sink + 1;

  // Edges are stored in pairs (forward at an even index, its residual at the
  // odd index right after), so the partner of edge e is always `e ^ 1`.
  const edgeTo: number[] = [];
  const edgeCap: number[] = [];
  const graph: number[][] = Array.from({ length: nodeCount }, () => []);

  const addEdge = (from: number, to: number, capacity: number) => {
    graph[from].push(edgeTo.length);
    edgeTo.push(to);
    edgeCap.push(capacity);
    graph[to].push(edgeTo.length);
    edgeTo.push(from);
    edgeCap.push(0);
  };

  for (let player = 0; player < playerCount; player++) {
    addEdge(source, firstPlayer + player, 1);
    for (const slot of playerAllowedSlots[player]) {
      addEdge(firstPlayer + player, firstSlot + slot, 1);
    }
  }
  for (let slot = 0; slot < slotCount; slot++) {
    addEdge(firstSlot + slot, sink, slotCapacity);
  }

  const level = new Int32Array(nodeCount);
  const nextEdge = new Int32Array(nodeCount);
  const queue = new Int32Array(nodeCount);

  const buildLevelGraph = (): boolean => {
    level.fill(-1);
    level[source] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = source;
    while (head < tail) {
      const node = queue[head++];
      for (const edge of graph[node]) {
        if (edgeCap[edge] > 0 && level[edgeTo[edge]] < 0) {
          level[edgeTo[edge]] = level[node] + 1;
          queue[tail++] = edgeTo[edge];
        }
      }
    }
    return level[sink] >= 0;
  };

  const augment = (node: number, flow: number): number => {
    if (node === sink) return flow;
    for (; nextEdge[node] < graph[node].length; nextEdge[node]++) {
      const edge = graph[node][nextEdge[node]];
      const target = edgeTo[edge];
      if (edgeCap[edge] > 0 && level[target] === level[node] + 1) {
        const pushed = augment(target, Math.min(flow, edgeCap[edge]));
        if (pushed > 0) {
          edgeCap[edge] -= pushed;
          edgeCap[edge ^ 1] += pushed;
          return pushed;
        }
      }
    }
    return 0;
  };

  while (buildLevelGraph()) {
    nextEdge.fill(0);
    while (augment(source, Number.POSITIVE_INFINITY) > 0) {
      // keep pushing along the current level graph
    }
  }

  // A player -> slot edge that ended with no capacity left carried flow.
  const assignment: number[] = new Array(playerCount).fill(-1);
  for (let player = 0; player < playerCount; player++) {
    for (const edge of graph[firstPlayer + player]) {
      const target = edgeTo[edge];
      const isForwardToSlot =
        edge % 2 === 0 && target >= firstSlot && target < sink;
      if (isForwardToSlot && edgeCap[edge] === 0) {
        assignment[player] = target - firstSlot;
        break;
      }
    }
  }

  return assignment;
}

// Fills a specific combination of slots, using every player who can attend one.
function trySlotCombination(
  allPlayers: Array<{
    id: string;
    discordName: string;
    discordId: string;
    availableSlots: string[];
    hasPreferences: boolean;
    preferences: Array<{ draftSlotId: string }>;
  }>,
  slotCombo: Array<{
    id: string;
    draftDateTime: Date;
    season: number;
  }>,
) {
  const slotIndexById = new Map(
    slotCombo.map((slot, index) => [slot.id, index]),
  );

  const playerAllowedSlots = allPlayers.map(player =>
    player.availableSlots
      .map(slotId => slotIndexById.get(slotId))
      .filter((index): index is number => index !== undefined),
  );

  const assignment = assignPlayersToSlots(
    playerAllowedSlots,
    slotCombo.length,
    GROUP_SIZE,
  );

  const slotAssignments: Array<
    Array<{ id: string; discordName: string; discordId: string }>
  > = slotCombo.map(() => []);
  const stillUnassigned: Array<{
    id: string;
    discordName: string;
    discordId: string;
  }> = [];

  allPlayers.forEach((player, index) => {
    const entry = {
      id: player.id,
      discordName: player.discordName,
      discordId: player.discordId,
    };
    const slotIndex = assignment[index];
    if (slotIndex >= 0) {
      slotAssignments[slotIndex].push(entry);
    } else {
      stillUnassigned.push(entry);
    }
  });

  // Build completed groups (only slots that filled to GROUP_SIZE)
  const completedGroups: CompletedGroup[] = [];
  slotAssignments.forEach((players, index) => {
    if (players.length === GROUP_SIZE) {
      completedGroups.push({
        draftSlot: slotCombo[index],
        players,
      });
    } else if (players.length > 0) {
      // A partial group cannot draft, so its players go back in the pool
      stillUnassigned.push(...players);
    }
  });

  // For unassigned players, find their best potential slot
  const ungroupedPlayers = stillUnassigned.map(player => {
    const originalPlayer = allPlayers.find(p => p.id === player.id)!;
    let bestSlot = undefined;

    if (
      originalPlayer.hasPreferences &&
      originalPlayer.preferences.length > 0
    ) {
      // Use their first available preference from the combination
      const topPref = originalPlayer.preferences.filter(pref =>
        slotCombo.some(slot => slot.id === pref.draftSlotId),
      )[0];
      if (topPref) {
        bestSlot = slotCombo.find(slot => slot.id === topPref.draftSlotId);
      }
    }

    if (!bestSlot && originalPlayer.availableSlots.length > 0) {
      // Find first available slot in the combination
      bestSlot = slotCombo.find(slot =>
        originalPlayer.availableSlots.includes(slot.id),
      );
    }

    if (!bestSlot) {
      // Default to first slot in combination
      bestSlot = slotCombo[0];
    }

    return {
      ...player,
      bestSlot: bestSlot
        ? {
            id: bestSlot.id,
            draftDateTime: bestSlot.draftDateTime,
          }
        : undefined,
    };
  });

  // Analyze slot availability for ungrouped players
  const slotAvailabilityAnalysis = slotCombo.map(slot => {
    const unavailablePlayers = stillUnassigned.filter(player => {
      const originalPlayer = allPlayers.find(p => p.id === player.id)!;
      return !originalPlayer.availableSlots.includes(slot.id);
    });

    return {
      draftSlot: slot,
      unavailablePlayers,
      availablePlayerCount: stillUnassigned.length - unavailablePlayers.length,
    };
  });

  return {
    completedGroups,
    ungroupedPlayers,
    slotAvailabilityAnalysis,
  };
}

// Exhaustive slot search, largest number of complete groups first
function sortPlayersIntoDraftSlots(
  playersWithPreferences: Array<{
    id: string;
    discordName: string;
    discordId: string;
    preferences: Array<{ draftSlotId: string }>;
  }>,
  playersWithoutPreferences: Array<{
    id: string;
    discordName: string;
    discordId: string;
    allAvailableSlots: Array<string>; // All slots they're available for
  }>,
  draftSlots: Array<{
    id: string;
    draftDateTime: Date;
    season: number;
  }>,
  totalPlayers: number,
) {
  // Combine all players with their availability information
  const allPlayers = [
    ...playersWithPreferences.map(p => ({
      id: p.id,
      discordName: p.discordName,
      discordId: p.discordId,
      availableSlots: p.preferences.map(pref => pref.draftSlotId),
      hasPreferences: true,
      preferences: p.preferences,
    })),
    ...playersWithoutPreferences.map(p => ({
      id: p.id,
      discordName: p.discordName,
      discordId: p.discordId,
      availableSlots: p.allAvailableSlots,
      hasPreferences: false,
      preferences: [],
    })),
  ];

  // Whether a combination works is now decided exactly, so shuffling no longer
  // affects *whether* a solution is found -- only which of the valid groupings
  // comes back, which keeps re-sorting useful for varying who drafts together.
  const shuffledPlayers = shuffleArray(allPlayers);

  // One group per 12 players being sorted. Previously hardcoded to 4, which
  // silently capped the result at 48 players no matter how many were selected.
  const targetGroups = totalPlayers / GROUP_SIZE;

  // Work down from "every group filled" to fewer, returning the first size that
  // works. Because each combination is solved exactly, the first hit is the most
  // complete groups achievable -- so "3 of 4" now means 4 is genuinely
  // impossible, not that this attempt got unlucky.
  for (let groupCount = targetGroups; groupCount >= 1; groupCount--) {
    const slotCombinations = shuffleArray(
      getCombinations(draftSlots, groupCount),
    );

    for (const slotCombo of slotCombinations) {
      const result = trySlotCombination(shuffledPlayers, slotCombo);

      if (result.completedGroups.length === groupCount) {
        return result;
      }
    }
  }

  // Not even one full group is possible from any single slot.
  return {
    completedGroups: [],
    ungroupedPlayers: allPlayers.map(p => ({ ...p, bestSlot: undefined })),
    slotAvailabilityAnalysis: [],
  };
}

export default function LeagueSorting() {
  const { season, registrations, leagues } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  // Everyone starts as Tier 2; the admin flips the 12 Champions.
  const [playerTiers, setPlayerTiers] = useState<Record<string, PlayerTier>>(
    () =>
      Object.fromEntries(
        registrations.map(reg => [reg.user.id, 'tier2' as PlayerTier]),
      ),
  );

  // Registrations can arrive after mount (Remix revalidates loaders after an
  // action), so anyone missing from state falls back to the Tier 2 default.
  const tierOf = (userId: string): PlayerTier => playerTiers[userId] ?? 'tier2';

  const championPlayers = registrations
    .map(reg => reg.user.id)
    .filter(userId => tierOf(userId) === 'champions');
  const tier2Players = registrations
    .map(reg => reg.user.id)
    .filter(userId => tierOf(userId) === 'tier2');

  // Initialize league assignments with preserved data from action, if available
  const [leagueAssignments, setLeagueAssignments] = useState<
    Record<number, string>
  >(() => getLeagueAssignments(actionData));

  // Sync league assignments state with action data when it changes
  useEffect(() => {
    if (!actionData) return;

    if ('leagueAssignments' in actionData) {
      setLeagueAssignments(getLeagueAssignments(actionData));
      return;
    }

    // A fresh sort produces new groups, so any mapping from the previous run is
    // meaningless -- keeping it would arm the announce button with stale
    // league assignments and hand out the wrong roles.
    if ('sortingResult' in actionData) {
      setLeagueAssignments({});
    }
  }, [actionData]);

  const handleTierChange = (userId: string, tier: PlayerTier) => {
    setPlayerTiers(prev => ({ ...prev, [userId]: tier }));
  };

  const handleResetTiers = () => {
    setPlayerTiers(
      Object.fromEntries(
        registrations.map(reg => [reg.user.id, 'tier2' as PlayerTier]),
      ),
    );
  };

  // Champions draft as one league of 12; the rest must divide into whole groups.
  const hasValidChampionsCount = championPlayers.length === GROUP_SIZE;
  const hasValidTier2Count =
    tier2Players.length > 0 && tier2Players.length % GROUP_SIZE === 0;
  const isValidSelection = hasValidChampionsCount && hasValidTier2Count;

  // Get sorting results from action data
  const sortingResult =
    actionData && 'sortingResult' in actionData
      ? actionData.sortingResult
      : null;
  const playerPreferences: PlayerPreferences =
    actionData && 'playerPreferences' in actionData
      ? actionData.playerPreferences
      : {};

  // Champions that came back from the sort. They survive the announce POST too,
  // so the button can keep resubmitting them.
  const announcedChampions: AnnouncementPlayer[] =
    actionData && 'champions' in actionData && actionData.champions
      ? actionData.champions
      : [];

  const roleFailures = getRoleFailures(actionData);

  const championsSlotOptions: ChampionsSlotOption[] =
    actionData &&
    'championsSlotOptions' in actionData &&
    actionData.championsSlotOptions
      ? actionData.championsSlotOptions
      : [];

  // Helper function to safely access sorting result properties
  const getSortingResultData = (): SortingResultData | null => {
    if (
      !sortingResult ||
      typeof sortingResult !== 'object' ||
      Array.isArray(sortingResult)
    ) {
      return null;
    }
    return sortingResult as SortingResultData;
  };

  // Champions is assigned implicitly from the held-out 12, so it is never a
  // choice for a sorted group.
  const assignableLeagues = leagues.filter(
    league => league.name.toLowerCase() !== CHAMPIONS_LEAGUE,
  );

  // Check if all groups have been assigned to leagues
  const sortingData = getSortingResultData();
  const assignedLeagueIds = sortingData
    ? sortingData.completedGroups.map((_, index) => leagueAssignments[index])
    : [];
  const hasDuplicateLeagues =
    new Set(assignedLeagueIds.filter(Boolean)).size !==
    assignedLeagueIds.filter(Boolean).length;
  const allGroupsAssigned =
    sortingData &&
    sortingData.completedGroups.length > 0 &&
    Object.keys(leagueAssignments).length ===
      sortingData.completedGroups.length &&
    sortingData.completedGroups.every(
      (_, index: number) => leagueAssignments[index],
    ) &&
    !hasDuplicateLeagues;

  const handleLeagueAssignment = (groupIndex: number, leagueId: string) => {
    setLeagueAssignments(prev => ({
      ...prev,
      [groupIndex]: leagueId,
    }));
  };

  // Prepare announcement data
  const prepareAnnouncementData = (): AnnouncementPayload | null => {
    if (!allGroupsAssigned) return null;

    const sortingData = getSortingResultData();
    if (!sortingData) return null;

    try {
      return {
        groups: sortingData.completedGroups.map((group, index) => {
          const leagueId = leagueAssignments[index];
          const league = leagues.find(l => l.id === leagueId);

          return {
            leagueId: leagueId ?? '',
            leagueName: league?.name || `Group ${index + 1}`,
            draftSlot: {
              id: group.draftSlot.id,
              draftDateTime: group.draftSlot.draftDateTime.toISOString(),
              season: group.draftSlot.season,
            },
            players: group.players.map(player => ({
              id: player.id,
              discordName: player.discordName,
              discordId: player.discordId,
            })),
          };
        }),
        // Roles only -- champions are never rendered into an embed.
        champions: announcedChampions.map(player => ({
          id: player.id,
          discordName: player.discordName,
          discordId: player.discordId,
        })),
      };
    } catch (error) {
      console.error('Error preparing announcement data:', error);
      return null;
    }
  };

  const announcementPayload = prepareAnnouncementData();

  // Helper function to render player name with preferences popover
  const renderPlayerWithPopover = (player: any) => {
    if (!player || !player.id || !player.discordName) {
      return <span className='text-white'>Unknown Player</span>;
    }

    const preferences =
      playerPreferences && typeof playerPreferences === 'object'
        ? playerPreferences[player.id] || []
        : [];

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return <div className='text-white'>{player.discordName}</div>;
    }

    // Sort preferences by draft date/time (chronological order)
    const sortedPreferences = [...preferences].sort(
      (a, b) =>
        new Date(a.draftDateTime || 0).getTime() -
        new Date(b.draftDateTime || 0).getTime(),
    );

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className='text-white cursor-help hover:text-blue-300 underline decoration-dotted'>
            {player.discordName}
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-80 bg-gray-800 border border-gray-600 text-white'>
          <div className='space-y-2'>
            <p className='text-sm font-semibold text-gray-200 mb-2'>
              Draft Time Preferences:
            </p>
            <div className='space-y-1'>
              {sortedPreferences.map(pref => (
                <div key={pref.draftSlotId} className='text-xs text-gray-300'>
                  <LocalDateTime
                    value={pref.draftDateTime || new Date()}
                    locale='en-US'
                    options={{
                      timeZoneName: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-white'>
          League Sorting - {season.year} Season
        </h1>
        <p className='mt-1 text-sm text-gray-300'>
          Manage league assignments for registered players
        </p>
      </div>

      {/* Registered Players List */}
      <div>
        <div className='mb-4'>
          <h3 className='text-lg leading-6 font-medium text-white mb-4'>
            Registered Players ({registrations.length})
          </h3>

          {registrations.length > 0 && (
            <div className='flex items-center gap-4 mb-4'>
              <button
                type='button'
                onClick={handleResetTiers}
                className='px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700'
              >
                Reset All to Tier 2
              </button>
              <div className='text-sm'>
                <span
                  className={
                    hasValidChampionsCount
                      ? 'text-green-300'
                      : 'text-yellow-300'
                  }
                >
                  Champions: {championPlayers.length}/{GROUP_SIZE}
                </span>
                <span className='text-gray-500 mx-2'>|</span>
                <span
                  className={
                    hasValidTier2Count ? 'text-green-300' : 'text-yellow-300'
                  }
                >
                  Tier 2: {tier2Players.length}
                  {hasValidTier2Count
                    ? ` (${
                        tier2Players.length / GROUP_SIZE
                      } groups of ${GROUP_SIZE})`
                    : ` (need a multiple of ${GROUP_SIZE})`}
                </span>
              </div>
            </div>
          )}
        </div>

        {registrations.length === 0 ? (
          <p className='text-gray-400'>
            No players registered for this season.
          </p>
        ) : (
          <div>
            {registrations
              .sort((a, b) =>
                a.user.discordName.localeCompare(b.user.discordName),
              )
              .map((registration, index) => (
                <div
                  key={registration.id}
                  className={`p-2 ${
                    index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                  }`}
                >
                  <div className='text-white flex items-center gap-3'>
                    <div className='flex rounded overflow-hidden text-xs shrink-0'>
                      {(['champions', 'tier2'] as PlayerTier[]).map(tier => {
                        const isActive = tierOf(registration.user.id) === tier;
                        return (
                          <button
                            key={tier}
                            type='button'
                            aria-pressed={isActive}
                            onClick={() =>
                              handleTierChange(registration.user.id, tier)
                            }
                            className={`px-2 py-1 ${
                              isActive
                                ? tier === 'champions'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {tier === 'champions' ? 'Champions' : 'Tier 2'}
                          </button>
                        );
                      })}
                    </div>
                    {renderPlayerWithPopover(registration.user)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Sort into Draft Slots Form */}
        {registrations.length > 0 && (
          <div className='mt-6'>
            <Form method='post'>
              <input type='hidden' name='actionType' value='sortPlayers' />
              {tier2Players.map(playerId => (
                <input
                  key={playerId}
                  type='hidden'
                  name='tier2Players'
                  value={playerId}
                />
              ))}
              {championPlayers.map(playerId => (
                <input
                  key={playerId}
                  type='hidden'
                  name='championPlayers'
                  value={playerId}
                />
              ))}
              <div className='flex items-center gap-4'>
                <button
                  type='submit'
                  disabled={!isValidSelection}
                  className={`px-6 py-2 rounded font-medium ${
                    isValidSelection
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Sort into Draft Slots
                </button>
                <div className='text-sm text-gray-300'>
                  {isValidSelection
                    ? `Ready: ${GROUP_SIZE} Champions + ${
                        tier2Players.length / GROUP_SIZE
                      } Tier 2 groups of ${GROUP_SIZE}`
                    : !hasValidChampionsCount
                    ? `Mark exactly ${GROUP_SIZE} players as Champions to enable sorting`
                    : `Tier 2 count must be a multiple of ${GROUP_SIZE}`}
                </div>
              </div>
            </Form>
          </div>
        )}

        {/* Error Display */}
        {actionData && 'error' in actionData && (
          <div className='mt-6 bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4'>
            <p className='text-red-200'>{String(actionData.error)}</p>
          </div>
        )}

        {/* Success Display */}
        {actionData && 'success' in actionData && (
          <div className='mt-6 bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-4'>
            <p className='text-green-200'>{String(actionData.success)}</p>
          </div>
        )}

        {/* Role assignment failures -- the announcement still went out */}
        {roleFailures.length > 0 && (
          <div className='mt-6 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg p-4'>
            <h4 className='font-medium text-yellow-200 mb-2'>
              {roleFailures.length} role
              {roleFailures.length === 1 ? '' : 's'} could not be assigned -
              apply these by hand:
            </h4>
            <ul className='text-sm text-yellow-100 space-y-1'>
              {roleFailures.map((failure, index) => (
                <li key={`${failure.discordName}-${index}`}>
                  <span className='font-medium'>{failure.discordName}</span> (
                  {failure.leagueName}): {failure.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sorting Results */}
        {sortingData && (
          <div className='mt-8'>
            <h2 className='text-xl font-bold text-white mb-6'>
              Sorting Results
            </h2>

            {/* Completed Groups */}
            {Array.isArray(sortingData.completedGroups) &&
              sortingData.completedGroups.length > 0 && (
                <div className='mb-8'>
                  <div className='flex justify-between items-center mb-4'>
                    <h3 className='text-lg font-medium text-white'>
                      Completed Draft Slots (
                      {sortingData.completedGroups.length})
                    </h3>
                    <div className='flex gap-2 items-center'>
                      {hasDuplicateLeagues && (
                        <p className='text-sm text-yellow-300'>
                          Each league can only be assigned to one group.
                        </p>
                      )}
                      {/* Discord Announcement Button */}
                      {allGroupsAssigned && (
                        <Form method='post'>
                          <input
                            type='hidden'
                            name='actionType'
                            value='sendAnnouncement'
                          />
                          <input
                            type='hidden'
                            name='announcementData'
                            value={
                              announcementPayload
                                ? JSON.stringify(announcementPayload)
                                : ''
                            }
                          />
                          <button
                            type='submit'
                            title={`Posts the league embeds and assigns roles to ${
                              announcementPayload
                                ? announcementPayload.groups.reduce(
                                    (total, group) =>
                                      total + group.players.length,
                                    0,
                                  ) + announcementPayload.champions.length
                                : 0
                            } players (Champions included, roles only).`}
                            className='px-4 py-2 rounded font-medium text-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-2'
                          >
                            📢 Announce to Discord &amp; Assign Roles
                          </button>
                        </Form>
                      )}
                    </div>
                  </div>
                  <div className='space-y-6'>
                    {Array.isArray(sortingData.completedGroups) &&
                      sortingData.completedGroups.map((group, groupIndex) => (
                        <div
                          key={groupIndex}
                          className='bg-gray-800 border border-gray-600 rounded-lg p-4'
                        >
                          <div className='flex justify-between items-center mb-3'>
                            <h4 className='text-lg font-medium text-white'>
                              Draft Slot:{' '}
                              <LocalDateTime
                                value={
                                  group.draftSlot?.draftDateTime || new Date()
                                }
                                options={{
                                  year: 'numeric',
                                  month: 'numeric',
                                  day: 'numeric',
                                }}
                              />{' '}
                              at{' '}
                              <LocalDateTime
                                value={
                                  group.draftSlot?.draftDateTime || new Date()
                                }
                                options={{
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }}
                              />
                            </h4>
                            <select
                              value={leagueAssignments[groupIndex] || ''}
                              onChange={e =>
                                handleLeagueAssignment(
                                  groupIndex,
                                  e.target.value,
                                )
                              }
                              className='bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm'
                            >
                              <option value=''>Select League</option>
                              {assignableLeagues.map(league => {
                                const takenByAnotherGroup =
                                  assignedLeagueIds.some(
                                    (assignedId, otherIndex) =>
                                      assignedId === league.id &&
                                      otherIndex !== groupIndex,
                                  );
                                return (
                                  <option
                                    key={league.id}
                                    value={league.id}
                                    disabled={takenByAnotherGroup}
                                  >
                                    {league.name}
                                    {takenByAnotherGroup
                                      ? ' (already assigned)'
                                      : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div className='space-y-2'>
                            {(group.players || [])
                              .sort((a, b) =>
                                (a.discordName || '').localeCompare(
                                  b.discordName || '',
                                ),
                              )
                              .map(player => (
                                <div
                                  key={player.id}
                                  className='flex items-center justify-between'
                                >
                                  <span className='text-white'>
                                    {renderPlayerWithPopover(player)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Ungrouped Players */}
            {Array.isArray(sortingData.ungroupedPlayers) &&
              sortingData.ungroupedPlayers.length > 0 && (
                <div className='mb-8'>
                  <h3 className='text-lg font-medium text-yellow-400 mb-4'>
                    Unable to Group ({sortingData.ungroupedPlayers.length}{' '}
                    players)
                  </h3>
                  <div className='bg-yellow-900 border border-yellow-600 rounded-lg p-4'>
                    <div className='space-y-2'>
                      {sortingData.ungroupedPlayers.map(player => (
                        <div
                          key={player.id || Math.random()}
                          className='text-yellow-100'
                        >
                          {renderPlayerWithPopover(player)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {/* Best draft times for the Champions league */}
            {championsSlotOptions.length > 0 && (
              <div className='mt-8'>
                <h3 className='text-lg font-medium text-white mb-1'>
                  Champions Draft Time Options
                </h3>
                <p className='text-sm text-gray-400 mb-4'>
                  Ranked by how many of the {announcedChampions.length}{' '}
                  Champions can attend. Champions with no recorded preferences
                  count as available for every slot.
                </p>
                <div className='space-y-2'>
                  {championsSlotOptions.map((option, index) => {
                    const isBest =
                      option.availableCount ===
                      championsSlotOptions[0].availableCount;
                    return (
                      <div
                        key={option.draftSlot.id}
                        className={`rounded-lg p-3 border ${
                          isBest
                            ? 'bg-green-900 bg-opacity-20 border-green-600'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className='flex items-center justify-between gap-4 flex-wrap'>
                          <div className='flex items-center gap-2'>
                            <span className='text-gray-500 text-sm'>
                              #{index + 1}
                            </span>
                            <span className='text-white'>
                              <LocalDateTime
                                value={option.draftSlot.draftDateTime}
                                locale='en-US'
                                options={{
                                  weekday: 'short',
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                  timeZoneName: 'short',
                                }}
                              />
                            </span>
                            {option.usedByGroup && (
                              <span className='text-xs text-yellow-300 border border-yellow-700 rounded px-1.5 py-0.5'>
                                also a Tier 2 group slot
                              </span>
                            )}
                          </div>
                          <span
                            className={
                              isBest ? 'text-green-300' : 'text-gray-300'
                            }
                          >
                            {option.availableCount}/{announcedChampions.length}{' '}
                            available
                          </span>
                        </div>
                        {option.unavailablePlayers.length > 0 && (
                          <p className='text-xs text-red-300 mt-2'>
                            Can&apos;t make it:{' '}
                            {option.unavailablePlayers
                              .map(player => player.discordName)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Slot Availability Analysis */}
            {Array.isArray(sortingData.slotAvailabilityAnalysis) &&
              sortingData.slotAvailabilityAnalysis.length > 0 && (
                <div className='mt-8'>
                  <h3 className='text-lg font-medium text-gray-300 mb-4'>
                    Slot Availability Analysis
                  </h3>
                  <div className='space-y-4'>
                    {sortingData.slotAvailabilityAnalysis.map(
                      (analysis, index) => (
                        <div
                          key={index}
                          className='bg-gray-800 border border-gray-600 rounded-lg p-4'
                        >
                          <h4 className='text-white font-medium mb-2'>
                            <LocalDateTime
                              value={
                                analysis.draftSlot?.draftDateTime || new Date()
                              }
                              options={{
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                              }}
                            />{' '}
                            at{' '}
                            <LocalDateTime
                              value={
                                analysis.draftSlot?.draftDateTime || new Date()
                              }
                              options={{
                                hour: '2-digit',
                                minute: '2-digit',
                              }}
                            />
                          </h4>
                          <p className='text-gray-300 text-sm mb-2'>
                            Available Players:{' '}
                            {analysis.availablePlayerCount || 0}
                          </p>
                          {Array.isArray(analysis.unavailablePlayers) &&
                            analysis.unavailablePlayers.length > 0 && (
                              <div>
                                <p className='text-red-300 text-sm mb-1'>
                                  Unavailable Players:
                                </p>
                                <div className='text-red-400 text-sm space-y-1'>
                                  {analysis.unavailablePlayers.map(player => (
                                    <div key={player.id || Math.random()}>
                                      {player.discordName || 'Unknown Player'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {/* Success Message */}
            {sortingData &&
              Array.isArray(sortingData.completedGroups) &&
              sortingData.completedGroups.length > 0 &&
              Array.isArray(sortingData.ungroupedPlayers) &&
              sortingData.ungroupedPlayers.length === 0 && (
                <div className='bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-4'>
                  <p className='text-green-200'>
                    ✅ Successfully sorted all{' '}
                    {sortingData.completedGroups.length * GROUP_SIZE} players
                    into {sortingData.completedGroups.length} complete draft
                    slots!
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
