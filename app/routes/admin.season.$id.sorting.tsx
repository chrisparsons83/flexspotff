import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedActionData, useTypedLoaderData } from 'remix-typedjson';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { EmbedBuilder } from 'discord.js';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { getSeasonById } from '~/models/season.server';
import { getRegistrationsByYear } from '~/models/registration.server';
import { getDraftSlotsBySeason } from '~/models/draftSlot.server';
import { getUserDraftSlotPreferences } from '~/models/draftSlotPreference.server';
import { getLeaguesByYear } from '~/models/league.server';
import { sendMessageToChannel } from '~/../bot/utils';
import { envSchema } from '~/utils/helpers';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';

interface AnnouncementPlayer {
  id: string;
  discordName: string;
  discordId: string;
}

interface AnnouncementDraftSlot {
  id: string;
  draftDateTime: string;
  season: number;
}

interface AnnouncementGroup {
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

interface SlotAvailabilityAnalysis {
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
}

interface UngroupedPlayer {
  id: string;
  discordName: string;
  bestSlot?: {
    id: string;
    draftDateTime: Date;
  };
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

interface PlayerPreferences {
  [playerId: string]: Array<{
    draftSlotId: string;
    ranking: number;
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
  leagueName: z.string(),
  draftSlot: AnnouncementDraftSlotSchema,
  players: z.array(AnnouncementPlayerSchema),
});

const AnnouncementDataSchema = z.array(AnnouncementGroupSchema);

const env = envSchema.parse(process.env);

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

  if (actionType === 'saveLeagueAssignments') {
    // Handle league assignments
    const assignments: Array<{ draftSlotId: string; leagueId: string }> = [];
    
    // Extract assignments from form data
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('leagueAssignment_')) {
        const groupIndex = key.replace('leagueAssignment_', '');
        const draftSlotId = formData.get(`draftSlotId_${groupIndex}`) as string;
        if (value && draftSlotId) {
          assignments.push({
            draftSlotId,
            leagueId: value as string
          });
        }
      }
    }
    
    return typedjson({
      success: `Successfully assigned ${assignments.length} groups to leagues.`,
      assignments
    });
  }

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
    if (!announcementData || typeof announcementData !== 'string' || !announcementData.trim()) {
      return typedjson({
        error: 'No announcement data provided.',
      });
    }

    let groupData;
    try {
      const parsedData = JSON.parse(announcementData);
      const validationResult = AnnouncementDataSchema.safeParse(parsedData);
      
      if (!validationResult.success) {
        console.error('Announcement data validation failed:', validationResult.error);
        return typedjson({
          error: 'Invalid announcement data format. Please check the data structure.',
        });
      }
      
      groupData = validationResult.data;
    } catch (error) {
      console.error('Error parsing announcement data:', error);
      return typedjson({
        error: 'Failed to parse announcement data. Please try again.',
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
    const sortedLeagueNames = Object.keys(leagueGroups).sort((a, b) => a.localeCompare(b));

    // Create separate embeds for each league in alphabetical order
    const embeds: EmbedBuilder[] = [];

    const leagueColors: Record<string, number> = {
      admiral: 0x15c9bf,
      champions: 0xc29f04,
      dragon: 0x1f8b4c,
      galaxy: 0x3498db,
      monarch: 0xab59b6
    };
    
    sortedLeagueNames.forEach((leagueName) => {
      const groups = leagueGroups[leagueName];
      const embed = new EmbedBuilder()
        .setTitle(`🏈 ${leagueName} League 2025`)
        .setColor(leagueColors[leagueName.toLowerCase()] || 0x00ff00);

      groups.forEach((group: AnnouncementGroup) => {
        const playerList = group.players.map((p: AnnouncementPlayer) => `• ${p.discordName}`).join('\n');
        const draftTime = new Date(group.draftSlot.draftDateTime).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) + ' at ' +
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
          inline: false
        });
      });

      embeds.push(embed);
    });

    // Send to Discord
    if (env.LEAGUE_ANNOUNCEMENT_CHANNEL_ID) {
      try {
        console.log('Attempting to send Discord message with embeds:', embeds.length);
        await sendMessageToChannel({
          channelId: env.LEAGUE_ANNOUNCEMENT_CHANNEL_ID,
          messageData: {
            embeds: embeds
          }
        });
        console.log('Discord message sent successfully');
        
        // Extract league assignments from the group data to preserve them
        const leagues = await getLeaguesByYear(season.year);
        const leagueAssignments: Record<number, string> = {};
        
        // Convert announcement data back to original sorting result structure
        const reconstructedSortingResult = {
          completedGroups: groupData.map((group) => ({
            draftSlot: {
              id: group.draftSlot.id,
              draftDateTime: new Date(group.draftSlot.draftDateTime),
              season: group.draftSlot.season
            },
            players: group.players.map((player) => ({
              id: player.id,
              discordName: player.discordName,
              discordId: player.discordId
            }))
          })),
          ungroupedPlayers: [], // Empty since all players are in groups for announcement
          slotAvailabilityAnalysis: [] // Empty for announcement
        };
        
        groupData.forEach((group, index) => {
          // Find the league ID by matching the league name
          const matchedLeague = leagues.find(l => l.name === group.leagueName);
          if (matchedLeague) {
            leagueAssignments[index] = matchedLeague.id;
          }
        });

        return typedjson({
          success: 'Draft group assignments successfully announced to Discord!',
          sortingResult: reconstructedSortingResult, // Preserve the sorting results in correct structure
          leagueAssignments, // Preserve the league assignments
          playerPreferences: {} as Record<string, Array<{
            draftSlotId: string;
            draftDateTime: Date;
            ranking: number;
          }>>, // Keep empty for now
        });
      } catch (error: any) {        
        let errorMessage = 'Unknown error occurred';
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.toString) {
            errorMessage = error.toString();
          }
        }
        
        // Extract league assignments from the group data to preserve them even on error
        const leagues = await getLeaguesByYear(season.year);
        const leagueAssignments: Record<number, string> = {};
        
        // Convert announcement data back to original sorting result structure
        const reconstructedSortingResult = {
          completedGroups: groupData.map((group) => ({
            draftSlot: {
              id: group.draftSlot.id,
              draftDateTime: new Date(group.draftSlot.draftDateTime),
              season: group.draftSlot.season
            },
            players: group.players.map((player) => ({
              id: player.id,
              discordName: player.discordName,
              discordId: player.discordId
            }))
          })),
          ungroupedPlayers: [], // Empty since all players are in groups for announcement
          slotAvailabilityAnalysis: [] // Empty for announcement
        };
        
        groupData.forEach((group, index) => {
          const matchedLeague = leagues.find(l => l.name === group.leagueName);
          if (matchedLeague) {
            leagueAssignments[index] = matchedLeague.id;
          }
        });

        return typedjson({
          error: `Failed to send announcement to Discord: ${errorMessage}. Please try again.`,
          sortingResult: reconstructedSortingResult, // Preserve the sorting results in correct structure even on error
          leagueAssignments, // Preserve the league assignments even on error
          playerPreferences: {} as Record<string, Array<{
            draftSlotId: string;
            draftDateTime: Date;
            ranking: number;
          }>>, // Keep empty for now
        });
      }
    } else {
      // Extract league assignments from the group data to preserve them even on error
      const leagues = await getLeaguesByYear(season.year);
      const leagueAssignments: Record<number, string> = {};
      
      // Convert announcement data back to original sorting result structure
      const reconstructedSortingResult = {
        completedGroups: groupData.map((group) => ({
          draftSlot: {
            id: group.draftSlot.id,
            draftDateTime: new Date(group.draftSlot.draftDateTime),
            season: group.draftSlot.season
          },
          players: group.players.map((player) => ({
            id: player.id,
            discordName: player.discordName,
            discordId: player.discordId
          }))
        })),
        ungroupedPlayers: [], // Empty since all players are in groups for announcement
        slotAvailabilityAnalysis: [] // Empty for announcement
      };
      
      groupData.forEach((group, index) => {
        const matchedLeague = leagues.find(l => l.name === group.leagueName);
        if (matchedLeague) {
          leagueAssignments[index] = matchedLeague.id;
        }
      });

      return typedjson({
        error: 'League announcement channel not configured.',
        sortingResult: reconstructedSortingResult, // Preserve the sorting results in correct structure even on error
        leagueAssignments, // Preserve the league assignments even on error
        playerPreferences: {} as Record<string, Array<{
          draftSlotId: string;
          draftDateTime: Date;
          ranking: number;
        }>>, // Keep empty for now
      });
    }
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

    const selectedPlayerIds = formData.getAll('selectedPlayers') as string[];
    
    if (selectedPlayerIds.length === 0 || selectedPlayerIds.length % 12 !== 0) {
      return typedjson({
        error: 'Please select a multiple of 12 players.',
      });
    }

    try {
      // Get draft slots for this season
      const draftSlots = await getDraftSlotsBySeason({ season: season.year });
      
      if (draftSlots.length === 0) {
        return typedjson({
          error: 'No draft slots found for this season. Please create draft slots first.',
        });
      }

      // Get registrations to get player data
      const registrations = await getRegistrationsByYear(season.year);
      const selectedPlayerData = registrations.filter(reg => 
        selectedPlayerIds.includes(reg.user.id)
      ).map(reg => ({
        id: reg.user.id,
        discordName: reg.user.discordName,
        discordId: reg.user.discordId
      }));

      // Separate players with and without preferences
      const playersWithPreferences = [];
      const playersWithoutPreferences = [];
      
      for (const player of selectedPlayerData) {
        const preferences = await getUserDraftSlotPreferences(player.id, season.year);
        
        if (preferences.length > 0) {
          // Separate ranked vs unranked preferences
          const rankedPreferences = preferences.filter(p => p.ranking > 0);
          
          if (rankedPreferences.length > 0) {
            // Player has ranked preferences
            playersWithPreferences.push({
              id: player.id,
              discordName: player.discordName,
              discordId: player.discordId,
              preferences: rankedPreferences.map(p => ({
                draftSlotId: p.draftSlotId,
                ranking: p.ranking
              }))
            });
          } else {
            // Player has availability but no rankings - treat as available for all their slots
            playersWithoutPreferences.push({
              id: player.id,
              discordName: player.discordName,
              discordId: player.discordId,
              allAvailableSlots: preferences.map(p => p.draftSlotId)
            });
          }
        } else {
          // Player has no preferences recorded - assume they're available for all slots
          playersWithoutPreferences.push({
            id: player.id,
            discordName: player.discordName,
            discordId: player.discordId,
            allAvailableSlots: draftSlots.map(slot => slot.id) // Available for all slots
          });
        }
      }

      // Implement sorting algorithm
      const result = sortPlayersIntoDraftSlots(
        playersWithPreferences,
        playersWithoutPreferences,
        draftSlots,
        selectedPlayerIds.length
      );
      
      // draftSlots already fetched above for sorting
      
      // Create player preferences map for popover data
      const playerPreferencesMap: Record<string, Array<{
        draftSlotId: string;
        draftDateTime: Date;
        ranking: number;
      }>> = {};
      
      for (const player of selectedPlayerData) {
        const preferences = await getUserDraftSlotPreferences(player.id, season.year);
        if (preferences.length > 0) {
          playerPreferencesMap[player.id] = preferences.map(p => ({
            draftSlotId: p.draftSlotId,
            draftDateTime: p.draftSlot.draftDateTime,
            ranking: p.ranking
          }));
        }
      }
      
      return typedjson({
        sortingResult: result,
        selectedCount: selectedPlayerIds.length,
        playerPreferences: playerPreferencesMap,
        allDraftSlots: draftSlots,
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

// Helper function to try a specific combination of 4 slots
function trySlotCombination(
  allPlayers: Array<{
    id: string;
    discordName: string;
    discordId: string;
    availableSlots: string[];
    hasPreferences: boolean;
    preferences: Array<{ draftSlotId: string; ranking: number }>;
  }>,
  slotCombo: Array<{
    id: string;
    draftDateTime: Date;
    season: number;
  }>
) {
  const slotAssignments: Map<string, Array<{ id: string; discordName: string; discordId: string }>> = new Map();
  slotCombo.forEach(slot => {
    slotAssignments.set(slot.id, []);
  });

  // Shuffle players to avoid deterministic results
  const shuffledPlayers = [...allPlayers].sort(() => Math.random() - 0.5);
  const unassignedPlayers: Array<{ id: string; discordName: string; discordId: string }> = [];
  
  // First pass: assign players with preferences
  for (const player of shuffledPlayers.filter(p => p.hasPreferences)) {
    let assigned = false;
    
    // Sort player's preferences by ranking (1 is highest preference)
    const sortedPreferences = [...player.preferences].sort((a, b) => a.ranking - b.ranking);
    
    for (const pref of sortedPreferences) {
      if (!slotCombo.some(slot => slot.id === pref.draftSlotId)) continue; // Skip if slot not in this combination
      
      const currentAssignment = slotAssignments.get(pref.draftSlotId);
      if (currentAssignment && currentAssignment.length < 12) {
        currentAssignment.push({ id: player.id, discordName: player.discordName, discordId: player.discordId });
        assigned = true;
        break;
      }
    }
    
    if (!assigned) {
      unassignedPlayers.push({ id: player.id, discordName: player.discordName, discordId: player.discordId });
    }
  }

  // Second pass: assign players without preferences to available slots they can attend
  for (const player of shuffledPlayers.filter(p => !p.hasPreferences)) {
    let assigned = false;
    
    // Shuffle their available slots that are in this combination
    const availableInCombo = slotCombo.filter(slot => player.availableSlots.includes(slot.id));
    const shuffledAvailable = [...availableInCombo].sort(() => Math.random() - 0.5);
    
    for (const slot of shuffledAvailable) {
      const currentAssignment = slotAssignments.get(slot.id);
      if (currentAssignment && currentAssignment.length < 12) {
        currentAssignment.push({ id: player.id, discordName: player.discordName, discordId: player.discordId });
        assigned = true;
        break;
      }
    }
    
    if (!assigned) {
      unassignedPlayers.push({ id: player.id, discordName: player.discordName, discordId: player.discordId });
    }
  }

  // Return result with completed groups and ungrouped players
  const shuffledUnassigned = [...unassignedPlayers].sort(() => Math.random() - 0.5);
  const stillUnassigned: Array<{ id: string; discordName: string; discordId: string }> = [];
  
  for (const player of shuffledUnassigned) {
    let assigned = false;
    const originalPlayer = allPlayers.find(p => p.id === player.id)!;
    
    // Try any slot in the combination that they can attend
    const availableInCombo = slotCombo.filter(slot => originalPlayer.availableSlots.includes(slot.id));
    
    for (const slot of availableInCombo) {
      const currentAssignment = slotAssignments.get(slot.id);
      if (currentAssignment && currentAssignment.length < 12) {
        currentAssignment.push({ id: player.id, discordName: player.discordName, discordId: player.discordId });
        assigned = true;
        break;
      }
    }
    
    if (!assigned) {
      stillUnassigned.push(player);
    }
  }

  // Build completed groups (only slots with exactly 12 players)
  const completedGroups = [];
  for (const [slotId, players] of slotAssignments) {
    if (players.length === 12) {
      const slot = slotCombo.find(s => s.id === slotId)!;
      completedGroups.push({
        draftSlot: slot,
        players
      });
    } else if (players.length > 0) {
      // Add incomplete groups back to unassigned
      stillUnassigned.push(...players);
    }
  }

  // For unassigned players, find their best potential slot
  const ungroupedPlayers = stillUnassigned.map(player => {
    const originalPlayer = allPlayers.find(p => p.id === player.id)!;
    let bestSlot = undefined;
    
    if (originalPlayer.hasPreferences && originalPlayer.preferences.length > 0) {
      // Use their top preference from the combination
      const topPref = originalPlayer.preferences
        .filter(pref => slotCombo.some(slot => slot.id === pref.draftSlotId))
        .sort((a, b) => a.ranking - b.ranking)[0];
      if (topPref) {
        bestSlot = slotCombo.find(slot => slot.id === topPref.draftSlotId);
      }
    }
    
    if (!bestSlot && originalPlayer.availableSlots.length > 0) {
      // Find first available slot in the combination
      bestSlot = slotCombo.find(slot => originalPlayer.availableSlots.includes(slot.id));
    }
    
    if (!bestSlot) {
      // Default to first slot in combination
      bestSlot = slotCombo[0];
    }
    
    return {
      ...player,
      bestSlot: bestSlot ? {
        id: bestSlot.id,
        draftDateTime: bestSlot.draftDateTime
      } : undefined
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
      availablePlayerCount: stillUnassigned.length - unavailablePlayers.length
    };
  });

  return {
    completedGroups,
    ungroupedPlayers,
    slotAvailabilityAnalysis
  };
}

// Helper function to calculate the score for a slot combination
function calculateCombinationScore(
  result: {
    completedGroups: CompletedGroup[];
    ungroupedPlayers: UngroupedPlayer[];
    slotAvailabilityAnalysis: SlotAvailabilityAnalysis[];
  },
  slotCombo: Array<{
    id: string;
    draftDateTime: Date;
    season: number;
  }>,
  allPlayers: Array<{
    id: string;
    discordName: string;
    discordId: string;
    availableSlots: string[];
    hasPreferences: boolean;
    preferences: Array<{ draftSlotId: string; ranking: number }>;
  }>
): number {
  // Primary score: number of completed groups (most important)
  let score = result.completedGroups.length * 1000;
  
  // Tiebreaker: highest available player count for any slot among ungrouped
  if (result.slotAvailabilityAnalysis.length > 0) {
    const maxAvailableCount = Math.max(...result.slotAvailabilityAnalysis.map(analysis => analysis.availablePlayerCount));
    score += maxAvailableCount;
  }
  
  return score;
}

// Brute-force optimal slot combination algorithm
function sortPlayersIntoDraftSlots(
  playersWithPreferences: Array<{
    id: string;
    discordName: string;
    discordId: string;
    preferences: Array<{ draftSlotId: string; ranking: number }>;
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
  totalPlayers: number
) {
  // Combine all players with their availability information
  const allPlayers = [
    ...playersWithPreferences.map(p => ({
      id: p.id,
      discordName: p.discordName,
      discordId: p.discordId,
      availableSlots: p.preferences.map(pref => pref.draftSlotId),
      hasPreferences: true,
      preferences: p.preferences
    })),
    ...playersWithoutPreferences.map(p => ({
      id: p.id,
      discordName: p.discordName,
      discordId: p.discordId,
      availableSlots: p.allAvailableSlots,
      hasPreferences: false,
      preferences: []
    }))
  ];

  // Randomize the order of players to ensure fair and varied group assignments
  const shuffledPlayers = [...allPlayers].sort(() => Math.random() - 0.5);

  const targetGroups = 4; // Always need exactly 4 groups
  
  // Generate all combinations of 4 slots from available draft slots
  const slotCombinations = getCombinations(draftSlots, targetGroups);
  
  let bestResult = null;
  let bestScore = -1;
  
  // Try each combination of 4 slots
  for (const slotCombo of slotCombinations) {
    const result = trySlotCombination(shuffledPlayers, slotCombo);
    
    // If we found a perfect solution (4 complete groups), return immediately
    if (result.completedGroups.length === 4) {
      return result;
    }
    
    // Calculate score for this combination
    const score = calculateCombinationScore(result, slotCombo, allPlayers);
    
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
    }
  }
  
  return bestResult || { completedGroups: [], ungroupedPlayers: allPlayers.map(p => ({ ...p, bestSlot: undefined })), slotAvailabilityAnalysis: [] };
};



export default function LeagueSorting() {
  const { season, registrations, leagues } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  // Initialize league assignments with preserved data from action, if available
  const preservedLeagueAssignments = actionData && 'leagueAssignments' in actionData ? actionData.leagueAssignments : {};
  const [leagueAssignments, setLeagueAssignments] = useState<Record<number, string>>(preservedLeagueAssignments || {});

  // Sync league assignments state with action data when it changes
  useEffect(() => {
    if (actionData && 'leagueAssignments' in actionData && actionData.leagueAssignments) {
      setLeagueAssignments(actionData.leagueAssignments);
    }
  }, [actionData]);

  const handlePlayerSelection = (userId: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedPlayers(prev => [...prev, userId]);
    } else {
      setSelectedPlayers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleInvertSelection = () => {
    // Get all user IDs
    const allUserIds = registrations.map(reg => reg.user.id);
    
    // Create new selection by inverting current state
    const newSelectedPlayers = allUserIds.filter(userId => 
      !selectedPlayers.includes(userId)
    );
    
    // Update state
    setSelectedPlayers(newSelectedPlayers);
    
    // Update DOM checkboxes to match new state
    const checkboxes = document.querySelectorAll('input[name="selectedPlayers"]') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(checkbox => {
      checkbox.checked = newSelectedPlayers.includes(checkbox.value);
    });
  };

  // Check if selected count is a multiple of 12 and greater than 0
  const isValidSelection = selectedPlayers.length > 0 && selectedPlayers.length % 12 === 0;

  // Get sorting results from action data
  const sortingResult = actionData && 'sortingResult' in actionData ? actionData.sortingResult : null;
  const playerPreferences: PlayerPreferences = actionData && 'playerPreferences' in actionData ? actionData.playerPreferences : {};

  // Helper function to safely access sorting result properties
  const getSortingResultData = (): SortingResultData | null => {
    if (!sortingResult || typeof sortingResult !== 'object' || Array.isArray(sortingResult)) {
      return null;
    }
    return sortingResult as SortingResultData;
  };

  // Check if all groups have been assigned to leagues
  const sortingData = getSortingResultData();
  const allGroupsAssigned = sortingData &&
    sortingData.completedGroups.length > 0 && 
    Object.keys(leagueAssignments).length === sortingData.completedGroups.length &&
    sortingData.completedGroups.every((_, index: number) => leagueAssignments[index]);

  const handleLeagueAssignment = (groupIndex: number, leagueId: string) => {
    setLeagueAssignments(prev => ({
      ...prev,
      [groupIndex]: leagueId
    }));
  };

  // Prepare announcement data
  const prepareAnnouncementData = (): AnnouncementGroup[] | null => {
    if (!allGroupsAssigned) return null;
    
    const sortingData = getSortingResultData();
    if (!sortingData) return null;
    
    try {
      return sortingData.completedGroups.map((group, index) => {
        const leagueId = leagueAssignments[index];
        const league = leagues.find(l => l.id === leagueId);
        
        return {
          leagueName: league?.name || `Group ${index + 1}`,
          draftSlot: {
            id: group.draftSlot.id,
            draftDateTime: group.draftSlot.draftDateTime.toISOString(),
            season: group.draftSlot.season
          },
          players: group.players.map((player) => ({
            id: player.id,
            discordName: player.discordName,
            discordId: player.discordId
          }))
        };
      });
    } catch (error) {
      console.error('Error preparing announcement data:', error);
      return null;
    }
  };
  
  // Helper function to render player name with preferences popover
  const renderPlayerWithPopover = (player: any) => {
    if (!player || !player.id || !player.discordName) {
      return <span className="text-white">Unknown Player</span>;
    }
    
    const preferences = playerPreferences && typeof playerPreferences === 'object' 
      ? (playerPreferences[player.id] || []) 
      : [];
    
    if (!Array.isArray(preferences) || preferences.length === 0) {
      return (
        <div className="text-white">
          {player.discordName}
        </div>
      );
    }
    
    // Sort preferences by draft date/time (chronological order)
    const sortedPreferences = [...preferences].sort((a, b) => 
      new Date(a.draftDateTime || 0).getTime() - new Date(b.draftDateTime || 0).getTime()
    );
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-white cursor-help hover:text-blue-300 underline decoration-dotted">
            {player.discordName}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-gray-800 border border-gray-600 text-white">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-200 mb-2">Draft Time Preferences:</p>
            <div className="space-y-1">
              {sortedPreferences.map((pref) => (
                <div key={pref.draftSlotId} className="text-xs text-gray-300">
                  {new Date(pref.draftDateTime || new Date()).toLocaleString('en-US', { 
                    timeZoneName: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          League Sorting - {season.year} Season
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          Manage league assignments for registered players
        </p>
      </div>

      {/* Registered Players List */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg leading-6 font-medium text-white mb-4">
            Registered Players ({registrations.length})
          </h3>
          
          {registrations.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={handleInvertSelection}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
              >
                Invert Selection
              </button>
            </div>
          )}
        </div>
        
        {registrations.length === 0 ? (
          <p className="text-gray-400">No players registered for this season.</p>
        ) : (
          <div>
            {registrations
              .sort((a, b) => a.user.discordName.localeCompare(b.user.discordName))
              .map((registration, index) => (
                <div
                  key={registration.id}
                  className={`p-2 ${
                    index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                  }`}
                >
                  <label className="text-white flex">
                    <input
                      type="checkbox"
                      name="selectedPlayers"
                      value={registration.user.id}
                      className="mr-2"
                      onChange={(e) => handlePlayerSelection(registration.user.id, e.target.checked)}
                    />
                    {renderPlayerWithPopover(registration.user)}
                  </label>
                </div>
              ))}
          </div>
        )}
        
        {/* Sort into Draft Slots Form */}
        {registrations.length > 0 && (
          <div className="mt-6">
            <Form method="post">
              <input type="hidden" name="actionType" value="sortPlayers" />
              {selectedPlayers.map(playerId => (
                <input
                  key={playerId}
                  type="hidden"
                  name="selectedPlayers"
                  value={playerId}
                />
              ))}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={!isValidSelection}
                  className={`px-6 py-2 rounded font-medium ${
                    isValidSelection
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Sort into Draft Slots
                </button>
                <div className="text-sm text-gray-300">
                  {selectedPlayers.length === 0 ? (
                    'Select players to enable sorting'
                  ) : selectedPlayers.length % 12 === 0 ? (
                    `${selectedPlayers.length} players selected (${selectedPlayers.length / 12} groups of 12)`
                  ) : (
                    `${selectedPlayers.length} players selected (need multiple of 12)`
                  )}
                </div>
              </div>
            </Form>
          </div>
        )}
        
        {/* Error Display */}
        {actionData && 'error' in actionData && (
          <div className="mt-6 bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4">
            <p className="text-red-200">{actionData.error}</p>
          </div>
        )}
        
        {/* Success Display */}
        {actionData && 'success' in actionData && (
          <div className="mt-6 bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-4">
            <p className="text-green-200">{actionData.success}</p>
          </div>
        )}
        
        {/* Sorting Results */}
        {sortingData && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-6">Sorting Results</h2>
            
            {/* Completed Groups */}
            {Array.isArray(sortingData.completedGroups) && sortingData.completedGroups.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white">
                    Completed Draft Slots ({sortingData.completedGroups.length})
                  </h3>
                  <div className="flex gap-2">
                    {/* Discord Announcement Button */}
                    {allGroupsAssigned && (
                      <Form method="post">
                        <input type="hidden" name="actionType" value="sendAnnouncement" />
                        <input 
                          type="hidden" 
                          name="announcementData" 
                          value={prepareAnnouncementData() ? JSON.stringify(prepareAnnouncementData()) : ''} 
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded font-medium text-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                        >
                          📢 Announce to Discord
                        </button>
                      </Form>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  {Array.isArray(sortingData.completedGroups) && sortingData.completedGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-medium text-white">
                          Draft Slot: {new Date(group.draftSlot?.draftDateTime || new Date()).toLocaleDateString()} at{' '}
                          {new Date(group.draftSlot?.draftDateTime || new Date()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </h4>
                        <select
                          value={leagueAssignments[groupIndex] || ''}
                          onChange={(e) => handleLeagueAssignment(groupIndex, e.target.value)}
                          className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm"
                        >
                          <option value="">Select League</option>
                          {leagues.map((league) => (
                            <option key={league.id} value={league.id}>
                              {league.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        {(group.players || [])
                          .sort((a, b) => (a.discordName || '').localeCompare(b.discordName || ''))
                          .map((player) => (
                          <div key={player.id} className="flex items-center justify-between">
                            <span className="text-white">{renderPlayerWithPopover(player)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Ungrouped Players */}
            {Array.isArray(sortingData.ungroupedPlayers) && sortingData.ungroupedPlayers.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium text-yellow-400 mb-4">
                  Unable to Group ({sortingData.ungroupedPlayers.length} players)
                </h3>
                <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                  <div className="space-y-2">
                    {sortingData.ungroupedPlayers.map((player) => (
                      <div key={player.id || Math.random()} className="text-yellow-100">
                        {renderPlayerWithPopover(player)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Slot Availability Analysis */}
            {Array.isArray(sortingData.slotAvailabilityAnalysis) && sortingData.slotAvailabilityAnalysis.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-300 mb-4">Slot Availability Analysis</h3>
                <div className="space-y-4">
                  {sortingData.slotAvailabilityAnalysis.map((analysis, index) => (
                    <div key={index} className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">
                        {new Date(analysis.draftSlot?.draftDateTime || new Date()).toLocaleDateString()} at{' '}
                        {new Date(analysis.draftSlot?.draftDateTime || new Date()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </h4>
                      <p className="text-gray-300 text-sm mb-2">
                        Available Players: {analysis.availablePlayerCount || 0}
                      </p>
                      {Array.isArray(analysis.unavailablePlayers) && analysis.unavailablePlayers.length > 0 && (
                        <div>
                          <p className="text-red-300 text-sm mb-1">Unavailable Players:</p>
                          <div className="text-red-400 text-sm space-y-1">
                            {analysis.unavailablePlayers.map((player) => (
                              <div key={player.id || Math.random()}>{player.discordName || 'Unknown Player'}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Success Message */}
            {sortingData && Array.isArray(sortingData.completedGroups) && sortingData.completedGroups.length > 0 && 
             Array.isArray(sortingData.ungroupedPlayers) && sortingData.ungroupedPlayers.length === 0 && (
              <div className="bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-4">
                <p className="text-green-200">
                  ✅ Successfully sorted all {selectedPlayers.length} players into {sortingData.completedGroups.length} complete draft slots!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
