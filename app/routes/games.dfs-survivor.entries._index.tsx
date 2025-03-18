import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import type { DFSSurvivorUserWeek, DFSSurvivorUserEntry, Season, Player } from '@prisma/client';
import DfsSurvivorWeekComponent from '~/components/layout/dfs-survivor/DfsSurvivorWeek';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { createDfsSurvivorYear, getDfsSurvivorYearByUserAndYear } from '~/models/dfssurvivoryear.server';
import { prisma } from '~/db.server';
import Button from '~/components/ui/Button';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';

// Define the AvailablePlayers type
type AvailablePlayers = {
  QB: Player[];
  RB: Player[];
  WR: Player[];
  TE: Player[];
  K: Player[];
  DEF: Player[];
  FLX: Player[];
};

type LoaderData = 
  | { isOpen: true; currentSeason: Season; dfsSurvivorWeeks: Array<DFSSurvivorUserWeek & { entries: Array<DFSSurvivorUserEntry & { player: Player & { currentNFLTeam?: { sleeperId: string } | null } }> }>; availablePlayers: AvailablePlayers }
  | { isOpen: false; currentSeason: Season | null };

// Type definition for the action response
type ActionResponse = 
  | { message: string; error?: string } 
  | { error: string; message?: string };

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const user = await authenticator.isAuthenticated(request, {
      failureRedirect: '/login',
    });

    const formData = await request.formData();
    const weeks = formData.getAll('weekId');
    
    // First, collect all player selections to check for duplicates
    const playerSelections = new Map<string, { weeks: Set<number>; positions: string[]; playerName?: string }>();
    const submittedWeeks = new Set<number>();
        
    // Collect all player selections from the form submission
    for (const weekId of weeks) {
      if (typeof weekId !== 'string') continue;

      const week = await prisma.dFSSurvivorUserWeek.findUnique({
        where: { id: weekId },
        include: { userYear: true }
      });

      if (!week || week.userYear.userId !== user.id) {
        return typedjson<ActionResponse>({ error: 'Invalid week or unauthorized' });
      }
      
      // Track which weeks are being submitted
      submittedWeeks.add(week.week);

      const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];
      
      for (const position of positions) {
        const playerId = formData.get(`playerId-${weekId}-${position}`);
        
        // Skip empty selections
        if (typeof playerId !== 'string' || !playerId) {
          continue;
        }

        
        // Get player info for better error messages
        const player = await prisma.player.findUnique({
          where: { id: playerId }
        });
        
        if (!player) {
          console.error(`Player not found for ID: ${playerId}`);
          return typedjson<ActionResponse>({ error: `Player not found for position ${position}` });
        }
        
        // Track this player selection
        if (!playerSelections.has(playerId)) {
          playerSelections.set(playerId, { 
            weeks: new Set([week.week]), 
            positions: [`${week.week}-${position}`],
            playerName: player.fullName
          });
        } else {
          const info = playerSelections.get(playerId)!;
          info.weeks.add(week.week);
          info.positions.push(`${week.week}-${position}`);
          // Add player name if not already set
          if (!info.playerName) {
            info.playerName = player.fullName;
          }
        }
      }
    }
    
    // Check for duplicate players within the current submission
    for (const [playerId, info] of playerSelections.entries()) {
      if (info.weeks.size > 1) {
        console.warn(`Player ${playerId} (${info.playerName}) selected in multiple weeks:`, Array.from(info.weeks));
        
        // Return error response
        return typedjson<ActionResponse>({ 
          error: `Cannot select ${info.playerName || 'player'} in multiple weeks (${Array.from(info.weeks).join(', ')})` 
        });
      }
      
      // Check for duplicate players within the same week
      const weekPositions = new Map<number, string[]>();
      for (const posInfo of info.positions) {
        const [week, position] = posInfo.split('-');
        const weekNum = parseInt(week);
        
        if (!weekPositions.has(weekNum)) {
          weekPositions.set(weekNum, []);
        }
        
        weekPositions.get(weekNum)!.push(position);
      }
      
      for (const [week, positions] of weekPositions.entries()) {
        if (positions.length > 1) {
          console.warn(`Player ${playerId} (${info.playerName}) selected multiple times in week ${week}:`, positions);
          
          // Return error response
          return typedjson<ActionResponse>({ 
            error: `Cannot select ${info.playerName || 'player'} multiple times in week ${week} (${positions.join(', ')})` 
          });
        }
      }
    }

    // Check for duplicate players against existing database entries
    // Get the current season
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      return typedjson<ActionResponse>({ error: 'No active season found' });
    }

    // Get all player IDs from the current submission
    const playerIds = Array.from(playerSelections.keys());
    
    // Find any existing entries for these players in weeks not included in this submission
    const existingEntries = await prisma.dFSSurvivorUserEntry.findMany({
      where: {
        userId: user.id,
        year: currentSeason.year,
        playerId: { in: playerIds },
        // Only look for entries in weeks not included in this submission
        NOT: {
          week: { in: Array.from(submittedWeeks) }
        }
      },
      include: {
        player: true
      }
    });
    
    
    // Check if any players in the current submission already exist in other weeks
    if (existingEntries.length > 0) {
      // Group by player ID for easier checking
      const existingByPlayer = new Map<string, { playerName: string, weeks: number[] }>();
      
      for (const entry of existingEntries) {
        if (!existingByPlayer.has(entry.playerId)) {
          existingByPlayer.set(entry.playerId, { 
            playerName: entry.player.fullName,
            weeks: [entry.week]
          });
        } else {
          existingByPlayer.get(entry.playerId)!.weeks.push(entry.week);
        }
      }
      
      // Check each player in the submission against existing entries
      for (const [playerId, info] of playerSelections.entries()) {
        if (existingByPlayer.has(playerId)) {
          const existing = existingByPlayer.get(playerId)!;
          const submittedWeek = Array.from(info.weeks)[0]; // We know there's only one week per player in the submission
          
          console.warn(`Player ${info.playerName} already exists in weeks ${existing.weeks.join(', ')} and is being submitted for week ${submittedWeek}`);
          
          // Return error response
          return typedjson<ActionResponse>({ 
            error: `Cannot select ${info.playerName || existing.playerName} in multiple weeks (${existing.weeks.join(', ')} and ${submittedWeek})` 
          });
        }
      }
    }

    // Check if any valid player selections were made AND if they are different from existing entries
    let hasChangedPlayerSelections = false;
    
    // First, get existing entries for the user
    const existingUserEntries = await prisma.dFSSurvivorUserEntry.findMany({
      where: {
        userId: user.id,
        year: currentSeason.year,
        week: { in: Array.from(submittedWeeks) }
      }
    });
    
    // Create a map of existing entries for easy comparison
    const existingEntriesMap = new Map<string, string>();
    existingUserEntries.forEach(entry => {
      const key = `${entry.week}-${entry.position}`;
      existingEntriesMap.set(key, entry.playerId);
    });
    
    // Check if any selections are different from what's already in the database
    for (const weekId of weeks) {
      if (typeof weekId !== 'string') continue;
      
      const week = await prisma.dFSSurvivorUserWeek.findUnique({
        where: { id: weekId },
        include: { userYear: true }
      });
      
      if (!week) continue;
      
      const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];
      
      for (const position of positions) {
        const playerId = formData.get(`playerId-${weekId}-${position}`);
        const key = `${week.week}-${position}`;
        
        // Check if this selection is different from what's already saved
        if (typeof playerId === 'string') {
          if (playerId) {
            // If there's a player selected, check if it's different from existing
            if (!existingEntriesMap.has(key) || existingEntriesMap.get(key) !== playerId) {
              hasChangedPlayerSelections = true;
              break;
            }
          } else {
            // If no player selected but one existed before, that's a change
            if (existingEntriesMap.has(key)) {
              hasChangedPlayerSelections = true;
              break;
            }
          }
        }
      }
      
      if (hasChangedPlayerSelections) break;
    }
    
    if (!hasChangedPlayerSelections) {
      return typedjson<ActionResponse>({ 
        message: 'No players saved. Please try selecting the player from the dropdown.' 
      });
    }

    // Now process each week and save entries
    for (const weekId of weeks) {
      if (typeof weekId !== 'string') continue;

      const week = await prisma.dFSSurvivorUserWeek.findUnique({
        where: { id: weekId },
        include: { userYear: true }
      });

      if (!week || week.userYear.userId !== user.id) {
        return typedjson<ActionResponse>({ error: 'Invalid week or unauthorized' });
      }

      const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];
      
      for (const position of positions) {
        const searchPosition = position === 'DEF' ? position : position.replace(/[12]/, '');
        const playerId = formData.get(`playerId-${weekId}-${position}`);
        
        // If playerId is empty string or not provided, delete any existing entry
        if (typeof playerId !== 'string' || !playerId) {
          await prisma.dFSSurvivorUserEntry.deleteMany({
            where: {
              userId: user.id,
              year: week.year,
              week: week.week,
              position: position
            }
          });
          continue;
        }

        const player = await prisma.player.findUnique({
          where: { 
            id: playerId,
          },
          include: { currentNFLTeam: true }
        });

        if (!player?.currentNFLTeam) {
          console.error(`Player not found or no team found for position ${searchPosition}`);
          return typedjson<ActionResponse>({ 
            error: `Player not found or no team found for position ${searchPosition}` 
          });
        }

        const nflGame = await prisma.nFLGame.findFirst({
          where: {
            week: week.week,
            year: week.year,
            OR: [
              { homeTeamId: player.currentNFLTeam.id },
              { awayTeamId: player.currentNFLTeam.id }
            ]
          }
        });

        if (!nflGame) {
          console.error(`Player ${player.fullName} is on a bye week for Week ${week.week}`);
          return typedjson<ActionResponse>({ 
            error: `Error: ${player.fullName} is on a bye week during week ${week.week}` 
          });
        }

        // First try to find an existing entry
        const existingEntry = await prisma.dFSSurvivorUserEntry.findFirst({
          where: {
            userId: user.id,
            year: week.year,
            week: week.week,
            position: position
          }
        });

        if (existingEntry) {
          // Update existing entry
          await prisma.dFSSurvivorUserEntry.update({
            where: { id: existingEntry.id },
            data: {
              nflGameId: nflGame.id,
              playerId: player.id,
              points: 0
            }
          });
        } else {
          // Create new entry
          await prisma.dFSSurvivorUserEntry.create({
            data: {
              userId: user.id,
              year: week.year,
              week: week.week,
              nflGameId: nflGame.id,
              playerId: player.id,
              points: 0,
              position: position
            }
          });
        }
      }
    }

    return typedjson<ActionResponse>({ 
      message: 'Entries successfully submitted' 
    });
  } catch (error) {
    // Simple error handling
    console.error(error);
    
    return typedjson<ActionResponse>({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason: null });
  }

  if (!currentSeason.isOpenForDFSSurvivor) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason });
  }

  let dfsSurvivorYear = await getDfsSurvivorYearByUserAndYear(user.id, currentSeason.year);
  if (!dfsSurvivorYear) {
    dfsSurvivorYear = await createDfsSurvivorYear(user.id, currentSeason.year);
  }

  // Get all players with their current teams
  const [qbPlayers, rbPlayers, wrPlayers, tePlayers, kPlayers, dstPlayersRaw] = await Promise.all([
    prisma.player.findMany({
      where: { 
        position: 'QB',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'RB',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'WR',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'TE',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'K',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'DEF',
        currentNFLTeamId: { not: null }
      },
      include: {
        currentNFLTeam: true
      },
      orderBy: { fullName: 'asc' }
    })
  ]);

  // Transform DEF players to use team abbreviations instead of full names
  const dstPlayers = dstPlayersRaw.map(player => ({
    ...player,
    fullName: player.currentNFLTeam?.sleeperId || player.fullName
  }));

  // Create flex players list
  const flexPlayers = [...rbPlayers, ...wrPlayers, ...tePlayers]
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const dfsSurvivorYearWithEntries = await prisma.dFSSurvivorUserYear.findUnique({
    where: { id: dfsSurvivorYear.id },
    include: {
      weeks: {
        include: {
          entries: {
            include: {
              player: {
                include: {
                  currentNFLTeam: true
                }
              }
            }
          }
        }
      }
    }
  });

  return typedjson<LoaderData>({ 
    dfsSurvivorWeeks: dfsSurvivorYearWithEntries?.weeks || [], 
    currentSeason, 
    isOpen: true,
    availablePlayers: {
      QB: qbPlayers,
      RB: rbPlayers,
      WR: wrPlayers,
      TE: tePlayers,
      K: kPlayers,
      DEF: dstPlayers,
      FLX: flexPlayers
    }
  });
};

export default function GamesDfsSurvivorMyEntry() {
  const data = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Track which weeks are expanded
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // Create a callback for week components to report errors
  const handleWeekError = useCallback((weekError: string | null) => {
    setError(weekError);
  }, []);

  // Toggle week expansion
  const toggleWeekExpansion = useCallback((weekId: string) => {
    console.log(`Toggling week expansion for week ${weekId}`);
    console.log(`Current expanded weeks: ${Array.from(expandedWeeks).join(', ')}`);
    
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekId)) {
        console.log(`Collapsing week ${weekId}`);
        newSet.delete(weekId);
      } else {
        console.log(`Expanding week ${weekId}`);
        newSet.add(weekId);
      }
      return newSet;
    });
  }, [expandedWeeks]);

  // Get all selected players across all weeks to validate no duplicates
  const allSelectedPlayers = useMemo(() => {
    if (!('dfsSurvivorWeeks' in data)) return new Map();
    
    const playerMap = new Map<string, { 
      weekId: string; 
      weekNumber: number; 
      position: string; 
      playerName: string 
    }>();
    
    data.dfsSurvivorWeeks.forEach(week => {
      week.entries.forEach(entry => {
        playerMap.set(entry.playerId, {
          weekId: week.id,
          weekNumber: week.week,
          position: entry.position,
          playerName: entry.player.fullName
        });
      });
    });
    
    return playerMap;
  }, [data]);

  // Track whether a player is already selected
  const isPlayerSelected = useCallback((playerId: string, weekId: string, position: string) => {
    if (allSelectedPlayers.has(playerId)) {
      const selection = allSelectedPlayers.get(playerId)!;
      // Allow the player to be selected in the same position they're already in
      return !(selection.weekId === weekId && selection.position === position);
    }
    return false;
  }, [allSelectedPlayers]);

  // Simplified handleSaveAll function without unnecessary JSON checks
  const handleSaveAll = useCallback(async () => {
    if (!('dfsSurvivorWeeks' in data)) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      console.log("Starting Save All process...");
      
      const formData = new FormData();
      
      // Get all the week forms from the DOM to ensure we're collecting the current state
      const weekForms = document.querySelectorAll(`form[id^="week-"]`);
      console.log(`Found ${weekForms.length} week forms to process`);
      
      // Track which week IDs we're submitting
      const submittedWeekIds = new Set<string>();
      
      // Collect all week IDs from visible forms first
      weekForms.forEach(form => {
        const weekIdInput = form.querySelector('input[name="weekId"]') as HTMLInputElement;
        if (weekIdInput && weekIdInput.value) {
          submittedWeekIds.add(weekIdInput.value);
          formData.append('weekId', weekIdInput.value);
        }
      });
      
      // Now collect all player selections from the forms
      weekForms.forEach(form => {
        const weekIdInput = form.querySelector('input[name="weekId"]') as HTMLInputElement;
        if (!weekIdInput || !weekIdInput.value) return;
        
        const weekId = weekIdInput.value;
        const playerInputs = form.querySelectorAll('input[name^="playerId-"]') as NodeListOf<HTMLInputElement>;
        
        playerInputs.forEach(input => {
          if (input.name.startsWith(`playerId-${weekId}`)) {
            formData.append(input.name, input.value || '');
          }
        });
      });
      
      // If no weeks found in the DOM, fall back to the data from the server
      if (submittedWeekIds.size === 0) {
        data.dfsSurvivorWeeks.forEach(week => {
          formData.append('weekId', week.id);
          
          week.entries.forEach(entry => {
            const inputName = `playerId-${week.id}-${entry.position}`;
            formData.append(inputName, entry.playerId);
          });
        });
      }
      
      // Use fetcher instead of fetch
      fetcher.submit(formData, { method: 'post' });
      
    } catch (err) {
      console.error("Error during save:", err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  }, [data, fetcher]);

  // Check if all weeks are scored
  const areAllWeeksScored = useMemo(() => {
    if (!('dfsSurvivorWeeks' in data)) return false;
    return data.dfsSurvivorWeeks.every(week => week.isScored);
  }, [data]);

  // Update error state when fetcher error changes
  useEffect(() => {
    if (fetcher.data?.error) {
      setError(fetcher.data.error);
    } else if (fetcher.data?.message) {
      // Clear error when there's a success message
      setError(null);
    }
  }, [fetcher.data]);

  if (!data.currentSeason) {
    return (
      <div>
        <h2>Season Not Available</h2>
        <p>Season is currently not available.</p>
      </div>
    );
  }

  if (!data.isOpen) {
    return (
      <div>
        <h2>DFS Survivor Closed</h2>
        <p>DFS survivor is currently closed for the season.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>My DFS Survivor Entries</h2>
      
      {/* Centralized success/error message display */}
      {fetcher.data?.message && !error && (
        <div className="text-white mb-4">
          {fetcher.data.message}
        </div>
      )}
      {error && (
        <div className="text-white mb-4">
          {error}
        </div>
      )}
      
      {/* Save All Entries button */}
      <div className="mb-4 flex justify-end">
        <Button 
          type="button" 
          onClick={handleSaveAll}
          disabled={isSaving || areAllWeeksScored}
          data-testid="save-all-entries-button"
        >
          {isSaving ? 'Saving...' : 'Save All Entries'}
        </Button>
      </div>
      
      {/* Week cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...data.dfsSurvivorWeeks].sort((a, b) => a.week - b.week).map((week) => (
          <div 
            key={week.id} 
            className={`week-container ${expandedWeeks.has(week.id) ? 'expanded-week' : 'collapsed-week'}`}
            data-expanded={expandedWeeks.has(week.id)}
          >
            <DfsSurvivorWeekComponent 
              week={week} 
              availablePlayers={data.availablePlayers}
              isExpanded={expandedWeeks.has(week.id)}
              onToggleExpand={() => toggleWeekExpansion(week.id)}
              isSaving={isSaving}
              isPlayerSelected={isPlayerSelected}
              formId={`week-${week.week}`}
              onError={handleWeekError}
              parentFetcher={fetcher}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
