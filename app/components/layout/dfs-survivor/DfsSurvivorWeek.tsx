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
import { useState, useEffect } from "react"
import clsx from "clsx"
import Button from "~/components/ui/Button"
import { Form } from "@remix-run/react"

interface Props {
  week: DFSSurvivorUserWeek & {
    entries: (DFSSurvivorUserEntry & {
      player: Player;
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
}

export default function DfsSurvivorWeekComponent({ week, availablePlayers = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
    FLX: []
}, isSaving, formId }: Props) {
    const totalPoints = week.entries.reduce((sum, entry) => sum + entry.points, 0);
    const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});
    const [inputValues, setInputValues] = useState<Record<string, string>>({});

    useEffect(() => {
        const initialSelected: Record<string, string> = {};
        const initialValues: Record<string, string> = {};
        week.entries.forEach(entry => {
            const position = entry.id.split('-').pop() || '';
            initialSelected[position] = entry.playerId;
            initialValues[position] = entry.player.fullName;
        });
        setSelectedPlayers(initialSelected);
        setInputValues(initialValues);
    }, [week.entries]);

    const getPositionPlayersArray = (position: string): Player[] => {
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
    };

    const getPositionPlayers = (position: string): string[] => {
        return getPositionPlayersArray(position).map(p => p.fullName);
    };

    const handlePlayerSelect = (position: string, playerName: string | boolean) => {
        // If playerName is not a string or is empty, clear the selection
        if (typeof playerName !== 'string' || !playerName) {
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
            return;
        }

        const positionPlayers = getPositionPlayersArray(position);
        const player = positionPlayers.find((p: Player) => 
            p.fullName.toLowerCase() === playerName.toLowerCase()
        );

        setInputValues(prev => ({
            ...prev,
            [position]: playerName
        }));

        if (player) {
            setSelectedPlayers(prev => ({
                ...prev,
                [position]: player.id
            }));
        } else {
            setSelectedPlayers(prev => {
                const newState = { ...prev };
                delete newState[position];
                return newState;
            });
        }
    };

    const formatPositionName = (position: string) => {
        if (position === 'DEF') return 'D/ST';
        return position.replace(/[0-9]/g, '');
    };

    const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];

    return (
        <Collapsible>
            <Card>
                <CollapsibleTrigger className="w-full">
                    <CardHeader>
                        <CardTitle>
                            <div className="header-row flex justify-between">
                                <div className="text-lg font-bold" data-testid={`week-${week.week}-form`}>
                                    {week.isScored ? `Week ${week.week} Scored` : `Week ${week.week}`}
                                </div>
                                <div className="text-lg font-bold">
                                    {totalPoints.toFixed(2)}
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent>
                        <Form method="post" reloadDocument>
                            {!week.isScored && <input type="hidden" name="weekId" value={week.id} />}
                            {positions.map((position) => {
                                const existingEntry = week.entries.find(entry => entry.id.endsWith(position));
                                const defaultPlayerName = existingEntry?.player.fullName || (week.isScored ? 'No Player Selected' : '');

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
                                                data-testid={`player-input-${position}`}
                                            />
                                            <div className="flex-1">
                                                <SearchSelect 
                                                    options={getPositionPlayers(position)}
                                                    onOptionSelect={(playerName) => handlePlayerSelect(position, playerName)}
                                                    onOptionSelectedChange={(value) => handlePlayerSelect(position, value)}
                                                    value={inputValues[position] || defaultPlayerName}
                                                    disabled={week.isScored}
                                                    className={clsx(week.isScored ? "border-none" : "", "font-bold")}
                                                    data-testid={`player-select-${position}`}
                                                />
                                            </div>
                                            {week.isScored && (
                                                <div className="w-16 text-right font-bold">
                                                    {week.entries.find(entry => entry.id.endsWith(position))?.points.toFixed(2) || '0.00'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="mt-4 flex justify-end">
                                <Button 
                                    type="submit"
                                    disabled={week.isScored}
                                >
                                    {week.isScored ? 'Week Scored' : 'Save Entry'}
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
