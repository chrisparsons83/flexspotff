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
import Button from "~/components/ui/Button"
import { useState, useEffect } from "react"
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
    DST: Player[];
    FLX: Player[];
  };
  isSaving: boolean;
}

export default function DfsSurvivorWeekComponent({ week, availablePlayers, isSaving }: Props) {
    const totalPoints = week.entries.reduce((sum, entry) => sum + entry.points, 0);
    const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});

    // Initialize selected players from existing entries
    useEffect(() => {
        const initialSelected: Record<string, string> = {};
        week.entries.forEach(entry => {
            // Use the position from the entry's ID
            const position = entry.id.split('-').pop() || '';
            initialSelected[position] = entry.playerId;
        });
        setSelectedPlayers(initialSelected);
    }, [week.entries]);

    const getPositionPlayers = (position: string) => {
        switch (position) {
            case 'QB1':
            case 'QB2':
                return availablePlayers.QB;
            case 'RB1':
            case 'RB2':
                return availablePlayers.RB;
            case 'WR1':
            case 'WR2':
                return availablePlayers.WR;
            case 'TE':
                return availablePlayers.TE;
            case 'FLEX1':
            case 'FLEX2':
                return availablePlayers.FLX;
            case 'K':
                return availablePlayers.K;
            case 'D/ST':
                return availablePlayers.DST;
            default:
                return [];
        }
    };

    const handlePlayerSelect = (position: string, playerName: string) => {
        const players = getPositionPlayers(position);
        const player = players.find(p => p.fullName === playerName);
        if (player) {
            setSelectedPlayers(prev => ({
                ...prev,
                [position]: player.id
            }));
        }
    };

    const positions = [
        { id: 'QB1', label: 'QB' },
        { id: 'QB2', label: 'QB' },
        { id: 'RB1', label: 'RB' },
        { id: 'RB2', label: 'RB' },
        { id: 'WR1', label: 'WR' },
        { id: 'WR2', label: 'WR' },
        { id: 'TE', label: 'TE' },
        { id: 'FLEX1', label: 'FLEX' },
        { id: 'FLEX2', label: 'FLEX' },
        { id: 'K', label: 'K' },
        { id: 'D/ST', label: 'D/ST' }
    ];

    return (
        <Collapsible>
            <Card>
                <CollapsibleTrigger className="w-full">
                    <CardHeader>
                        <CardTitle>
                            <div className="header-row flex justify-between">
                                <div className="text-lg font-bold">
                                    Week {week.week}
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
                            <input type="hidden" name="weekId" value={week.id} />
                            {positions.map(({ id, label }) => {
                                const existingEntry = week.entries.find(entry => entry.id.endsWith(id));
                                const defaultPlayerName = existingEntry?.player.fullName || '';
                                return (
                                    <div key={id} className="header-row flex justify-between items-center mb-2">
                                        <div className="text-base font-bold w-16">
                                            {label}
                                        </div>
                                        <div className="text-base flex-2 mx-1">
                                            <input type="hidden" name={`playerId-${id}`} value={selectedPlayers[id] || ''} />
                                            <SearchSelect 
                                                options={getPositionPlayers(id).map(player => player.fullName)}
                                                onOptionSelect={(playerName) => handlePlayerSelect(id, playerName)}
                                                onOptionSelectedChange={() => {}}
                                                value={defaultPlayerName}
                                                data-week-id={week.id}
                                                data-position={id}
                                                data-player-id={selectedPlayers[id]}
                                                data-entry-id={existingEntry?.id}
                                                data-selected-player
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="mt-4 flex justify-end">
                                <Button 
                                    type="submit"
                                    disabled={isSaving || Object.keys(selectedPlayers).length === 0}
                                >
                                    {isSaving ? 'Saving...' : 'Save Entries'}
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
