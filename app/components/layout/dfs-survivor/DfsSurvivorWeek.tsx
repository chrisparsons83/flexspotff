import type { DFSSurvivorUserWeek, DFSSurvivorUserEntry, Player } from '@prisma/client';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import SearchSelect from "~/components/ui/SearchSelect"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { useState, useCallback } from "react"
import clsx from "clsx"
import Button from "~/components/ui/Button"
import type { FetcherWithComponents } from "@remix-run/react"

type WeekGameTiming = {
  week: number;
  lastGameStartTime: Date;
  playerGameTimes: Record<string, Date>; // playerId -> game start time
};

interface Props {
  week: DFSSurvivorUserWeek & {
    entries: (DFSSurvivorUserEntry & {
      player: Player & {
        currentNFLTeam?: {
          sleeperId?: string;
        } | null;
      };
    })[];
  };
  availablePlayers: {
    QB: Player[];
    RB: Player[];
    WR: Player[];
    TE: Player[];
    K: Player[];
    DEF: Player[];
    FLX: Player[];
  };
  isSaving: boolean;
  formId: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isPlayerSelected?: (playerId: string, weekId: string, position: string) => boolean;
  onError?: (error: string | null) => void;
  globalError?: string | null;
  hasError?: boolean;
  parentFetcher: FetcherWithComponents<any>;
  weekGameTiming?: WeekGameTiming;
  currentTime?: Date;
}

export default function DfsSurvivorWeekComponent({ 
  week, 
  availablePlayers = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
    FLX: []
  }, 
  isSaving, 
  formId, 
  isExpanded = false,
  onToggleExpand,
  isPlayerSelected = () => false,
  onError, 
  globalError, 
  hasError = false,
  parentFetcher,
  weekGameTiming,
  currentTime
}: Props) {
    const totalPoints = week.entries.reduce((sum, entry) => sum + entry.points, 0);
    
    // Modify the initialization code to transform DEF player names
    const initialSelected: Record<string, string> = {};
    const initialValues: Record<string, string> = {};
    
    week.entries.forEach(entry => {
        const position = entry.position;
        initialSelected[position] = entry.playerId;
        
        // Transform DEF player names to abbreviations
        if (position === 'DEF' && entry.player.position === 'DEF' && entry.player.currentNFLTeam?.sleeperId) {
            initialValues[position] = entry.player.currentNFLTeam.sleeperId;
        } else {
            initialValues[position] = entry.player.fullName;
        }
    });
    
    const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>(initialSelected);
    const [inputValues, setInputValues] = useState<Record<string, string>>(initialValues);
    
    // Determine if the Save Entry button should be disabled
    const isSaveDisabled = useCallback(() => {
        // Disable if the week is already scored or if a fetch is in progress
        if (week.isScored || parentFetcher.state === 'submitting') {
            return true;
        }
        
        // Disable if the last game of the week has begun and timing data is available
        if (weekGameTiming && currentTime && currentTime >= weekGameTiming.lastGameStartTime) {
            return true;
        }
        
        return false;
    }, [week.isScored, parentFetcher.state, weekGameTiming, currentTime]);

    // Check if a specific player input should be disabled
    const isPlayerInputDisabled = useCallback((position: string, playerId?: string) => {
        // Always disable if week is scored or fetcher is submitting
        if (week.isScored || parentFetcher.state === 'submitting') {
            return true;
        }
        
        // If we have timing data and current time
        if (weekGameTiming && currentTime) {
            // Disable if the last game of the week has begun
            if (currentTime >= weekGameTiming.lastGameStartTime) {
                return true;
            }
            
            // If a specific player is selected, check if their game has started
            if (playerId && weekGameTiming.playerGameTimes[playerId]) {
                const playerGameTime = weekGameTiming.playerGameTimes[playerId];
                if (currentTime >= playerGameTime) {
                    return true;
                }
            }
        }
        
        return false;
    }, [week.isScored, parentFetcher.state, weekGameTiming, currentTime]);

    const checkForIntraWeekDuplicates = useCallback(() => {
        // Create a map of player IDs to the positions they're used in
        const playerCounts = new Map<string, { name: string, positions: Set<string> }>();
        
        Object.entries(selectedPlayers).forEach(([position, playerId]) => {
            if (!playerId) return;
            
            const playerName = inputValues[position];
            if (!playerName) return;

            // Use a Set to ensure unique positions
            const existing = playerCounts.get(playerId) || { name: playerName, positions: new Set() };
            existing.positions.add(position);
            playerCounts.set(playerId, existing);
        });

        for (const [, info] of playerCounts) {
            // Only consider it a duplicate if the same player is used in multiple DIFFERENT positions
            if (info.positions.size > 1) {
                const positionsArray = Array.from(info.positions);
                const error = `Cannot select ${info.name} multiple times in week ${week.week} (${positionsArray.join(', ')})`;
                // Pass error to parent component instead of handling locally
                onError?.(error);
                return true;
            }
        }

        // Notify parent that there's no error
        onError?.(null);
        return false;
    }, [selectedPlayers, inputValues, week.week, onError]);

    const getPositionPlayersArray = useCallback((position: string): Player[] => {
        switch (position) {
            case 'QB1':
            case 'QB2':
                return availablePlayers.QB || [];
            case 'RB1':
            case 'RB2':
                return availablePlayers.RB || [];
            case 'WR1':
            case 'WR2':
                return availablePlayers.WR || [];
            case 'TE':
                return availablePlayers.TE || [];
            case 'FLEX1':
            case 'FLEX2':
                return availablePlayers.FLX || [];
            case 'K':
                return availablePlayers.K || [];
            case 'DEF':
                return availablePlayers.DEF || [];
            default:
                return [];
        }
    }, [availablePlayers]);

    const getPositionPlayers = useCallback((position: string): string[] => {
        const players = getPositionPlayersArray(position);
        return players.map(p => p.fullName);
    }, [getPositionPlayersArray]);

    const handlePlayerSelect = useCallback((position: string, playerName: string | boolean) => {
        console.log(`Week ${week.week} player selection change - Position: ${position}, Player: ${playerName}`);
        
        // If playerName is not a string or is empty, clear the selection
        if (typeof playerName !== 'string' || !playerName) {
            console.log(`Week ${week.week} clearing player selection for ${position}`);
            setInputValues(prev => {
                const newState = { ...prev };
                delete newState[position];
                return newState;
            });
            setSelectedPlayers(prev => {
                const newState = { ...prev };
                delete newState[position];
                return newState;
            });
            
            // Notify parent component of the change
            console.log(`Week ${week.week} notifying parent of input change`);
            onError?.(null);
            return;
        }

        // Find matching player in available players for this position
        const players = getPositionPlayersArray(position);
        const player = players.find(p => p.fullName === playerName);

        if (player) {
            console.log(`Week ${week.week} player found:`, player.fullName);
            
            // Before setting, check if this player is already selected in another week
            if (isPlayerSelected(player.id, week.id, position)) {
                const error = `Player ${player.fullName} is already selected in another week`;
                console.log(`Week ${week.week} ${error}`);
                onError?.(error);
                return;
            }
            
            // Update state only if no error
            setSelectedPlayers(prev => ({
                ...prev,
                [position]: player.id
            }));
            setInputValues(prev => ({
                ...prev,
                [position]: playerName
            }));
            
            // Check for duplicate players within the same week
            setTimeout(() => {
                checkForIntraWeekDuplicates();
            }, 0);
        } else {
            console.log(`Week ${week.week} no matching player found for "${playerName}" in position ${position}`);
            setInputValues(prev => ({
                ...prev,
                [position]: playerName
            }));
            
            // Notify parent component of the change
            console.log(`Week ${week.week} notifying parent of input change`);
            onError?.(null);
        }
    }, [selectedPlayers, inputValues, getPositionPlayersArray, onError, week.week, week.id, isPlayerSelected, checkForIntraWeekDuplicates]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        console.log(`Week ${week.week} submit handler called`);
        
        if (checkForIntraWeekDuplicates()) {
            console.log(`Week ${week.week} has duplicate players, aborting submit`);
            return;
        }
        
        // Use parent's fetcher for form submission
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        // Add the weekId if not already present
        if (!formData.has('weekId')) {
            formData.append('weekId', week.id);
        }
        
        console.log(`Week ${week.week} submitting with ${formData.getAll('weekId').length} weekId entries`);
        
        // Submit the form using parent fetcher
        parentFetcher.submit(formData, { method: 'post' });
        
    }, [checkForIntraWeekDuplicates, week.id, week.week, parentFetcher]);

    const formatPositionName = useCallback((position: string) => {
        if (position === 'DEF') return 'D/ST';
        return position.replace(/[0-9]/g, '');
    }, []);

    const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];

    return (
        <Collapsible 
            data-testid={`week-${week.week}-form`} 
            open={isExpanded}
            onOpenChange={() => {
                console.log(`Week ${week.week} - Toggling expansion state from ${isExpanded} to ${!isExpanded}`);
                onToggleExpand?.();
            }}
        >
            <Card className="mb-4">
                <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Week {week.week}</CardTitle>
                        <div className="text-right">
                            <div className="text-sm">Total: {totalPoints.toFixed(2)}</div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent>
                        <form method="post" id={formId} onSubmit={handleSubmit}>
                            <input type="hidden" name="weekId" value={week.id} data-week-number={week.week} />
                            
                            {positions.map((position) => {
                                const existingEntry = week.entries.find(entry => entry.position === position);
                                const defaultPlayerName = existingEntry?.player.fullName || '';

                                return (
                                    <div key={position} className="header-row flex justify-between items-center mb-2" data-testid={`${position}-container`}>
                                        <div className="text-base font-bold w-16">
                                            {formatPositionName(position)}
                                        </div>
                                        <div className="text-base flex-2 mx-1 flex items-center gap-2">
                                            <input 
                                                type="hidden" 
                                                name={`playerId-${week.id}-${position}`} 
                                                value={selectedPlayers[position] || ''}
                                                data-player-name={inputValues[position] || ''}
                                                data-testid={`player-input-${position}`}
                                            />
                                            <div className="flex-1">
                                                                                <SearchSelect 
                                    options={getPositionPlayers(position)}
                                    onOptionSelect={(playerName) => handlePlayerSelect(position, playerName)}
                                    onOptionSelectedChange={(value) => handlePlayerSelect(position, value)}
                                    value={inputValues[position] || defaultPlayerName}
                                    disabled={isPlayerInputDisabled(position, selectedPlayers[position])}
                                    className={clsx(week.isScored ? "border-none" : "", "font-bold")}
                                    data-testid={`player-select-${position}`}
                                />
                                            </div>
                                            {week.isScored && (
                                                <div className="w-16 text-right font-bold" suppressHydrationWarning>
                                                    {existingEntry?.points.toFixed(2) || '0.00'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="mt-4 flex justify-end">
                                <Button 
                                    type="submit"
                                    disabled={isSaveDisabled()}
                                >
                                    {week.isScored 
                                        ? 'Week Scored' 
                                        : parentFetcher.state === 'submitting' 
                                            ? 'Saving...' 
                                            : 'Save Entry'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
