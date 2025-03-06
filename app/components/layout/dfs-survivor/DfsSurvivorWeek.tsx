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
import { Form } from "@remix-run/react"
import Button from "~/components/ui/Button"

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
  formId: string;
}

export default function DfsSurvivorWeekComponent({ week, availablePlayers, isSaving, formId }: Props) {
    const totalPoints = week.entries.reduce((sum, entry) => sum + entry.points, 0);
    const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const initialSelected: Record<string, string> = {};
        week.entries.forEach(entry => {
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
                return availablePlayers.DEF;
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

    const formatPositionName = (position: string) => {
        return position.replace(/[0-9]/g, '');
    };

    const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'D/ST'];

    return (
        <Collapsible>
            <Card>
                <CollapsibleTrigger className="w-full">
                    <CardHeader>
                        <CardTitle>
                            <div className="header-row flex justify-between">
                                <div className="text-lg font-bold">
                                    <div 
                                        className={`p-4 rounded-lg border ${week.isScored ? 'border-green-500' : 'border-gray-700'} ${isExpanded ? 'bg-gray-800' : 'bg-gray-900'}`}
                                        data-testid={`week-${week.week}`}
                                    >
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-semibold">Week {week.week}</h3>
                                            <div className="flex items-center gap-2">
                                                {week.isScored && (
                                                    <span className="text-green-500">Scored</span>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsExpanded(!isExpanded);
                                                    }}
                                                    className="text-gray-400 hover:text-white"
                                                    data-testid={`week-${week.week}-toggle`}
                                                >
                                                    {isExpanded ? 'Collapse' : 'Expand'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                        <Form method="post" reloadDocument id={formId}>
                            <input type="hidden" name="weekId" value={week.id} />
                            {isExpanded && (
                                <div className="space-y-4">
                                    {positions.map((position) => {
                                        const existingEntry = week.entries.find(entry => entry.id.endsWith(position));
                                        const positionColor = getPositionColor(position);
                                        return (
                                            <div key={position} className="flex items-center gap-4">
                                                <div className="w-20 font-semibold" style={{ color: positionColor }}>
                                                    {position}
                                                </div>
                                                <div className="flex-1">
                                                    <SearchSelect
                                                        name={`playerId-${week.id}-${position}`}
                                                        options={getPositionPlayers(position)}
                                                        defaultValue={existingEntry?.playerId}
                                                        className={`w-full ${week.isScored ? 'border-none' : ''}`}
                                                        textColor={week.isScored ? positionColor : undefined}
                                                        data-testid={`${position}-select`}
                                                    />
                                                </div>
                                                {week.isScored && existingEntry && (
                                                    <div className="w-20 text-right" data-testid={`${existingEntry.player.fullName}-score`}>
                                                        {existingEntry.points.toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="mt-4 flex justify-end">
                                <Button 
                                    type="submit"
                                    disabled={isSaving || Object.keys(selectedPlayers).length === 0 || week.isScored}
                                >
                                    {isSaving ? 'Saving...' : week.isScored ? 'Week Scored' : 'Save Entry'}
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
