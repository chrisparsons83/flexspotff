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

export default function DfsSurvivorWeekComponent() {
    return (
        <Collapsible>
            <Card>
                <CollapsibleTrigger className="w-full">
                    <CardHeader>
                        <CardTitle>
                            <div className="header-row flex justify-between">
                                <div className="text-lg font-bold">
                                    Week 1
                                </div>
                                <div className="text-lg font-bold">
                                    196.87
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent>
                        {['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'D/ST'].map((position, index) => (
                            <div key={index} className="header-row flex justify-between items-center mb-2">
                                <div className="text-base font-bold w-16">
                                    {position}
                                </div>
                                <div className="text-base flex-2 mx-1">
                                    <SearchSelect 
                                        options={['Tua Turndaballova', 'Patrick Mahomes', 'Josh Allen', 'Jalen Hurts', 'Justin Herbert', 'Jared Goff', "Justin Jefferson", 'Clyde Edwards-Helaire', "Julian Edleman"]}
                                        onOptionSelect={(selectedOption) => { console.log('Selected option:', selectedOption); }}
                                        onOptionSelectedChange={(isOptionChanged) => { console.log('Selected options changed:', isOptionChanged); }}>
                                    </SearchSelect>
                                </div>
                                <div className="text-base font-bold w-16 text-right">
                                    53.73
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
