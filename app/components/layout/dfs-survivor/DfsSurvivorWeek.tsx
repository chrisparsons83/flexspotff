import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "~/components/ui/card"
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
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                QB
                            </div>
                            <div className="text-base">
                                Matthew Stafford
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                QB
                            </div>
                            <div className="text-base">
                                Tua Turndaballova
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                RB
                            </div>
                            <div className="text-base">
                                Saquon Barkley
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                RB
                            </div>
                            <div className="text-base">
                                Clyde Edwards-Helaire
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                WR
                            </div>
                            <div className="text-base">
                                Allen Lazard
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                WR
                            </div>
                            <div className="text-base">
                                Tim Jones
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                TE
                            </div>
                            <div className="text-base">
                                T.J. Hockenson
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                FLEX
                            </div>
                            <div className="text-base">
                                Clyde Edwards-Helaire
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                K
                            </div>
                            <div className="text-base">
                                Jake Bates
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                        <div className="header-row flex justify-between">
                            <div className="text-base font-bold">
                                D/ST
                            </div>
                            <div className="text-base">
                                Carolina Panthers
                            </div>
                            <div className="text-base font-bold">
                                53.73
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                    </CardFooter>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}