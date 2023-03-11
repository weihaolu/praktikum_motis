import { XYChart, BarSeries, Axis, Tooltip } from "@visx/xychart";
import React, { ReactNode, useContext, useState } from 'react';

import { scaleLinear, scaleTime } from "@visx/scale";
import { TestTheshold } from "./TestThreshold";
import { TestTheshold2 } from "./TestThreshold2";
import { CpacityChart } from "./CapacityChart";




interface BeforeAfterViewProps {
    canceldRoundTrips: any[]
}
export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({ canceldRoundTrips }) => {
    const preData: any = {};

    for (const canceledRoundTrip of canceldRoundTrips) {
        const distDiffs = canceledRoundTrip.beforeAfter.distDiffs;
        Object.keys(distDiffs).forEach(procentageIncrease => {
            if (preData[procentageIncrease]) {
                preData[procentageIncrease] += distDiffs[procentageIncrease];
            } else {
                preData[procentageIncrease] = distDiffs[procentageIncrease];
            }
        })
    }

    const data = Object.entries(preData).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10));
    console.log(data);
    const width = 700;
    const height = 700;
    const tabs: Tab[] = [
        { label: 'BarChart', content: (<CpacityChart width={width} height={height} data={data} />) },
        { label: 'Threshold1', content: (<TestTheshold width={width} height={height} />) },
        { label: 'Threshold2', content: (<TestTheshold2 width={width} height={height} />) }
    ]

    return (
        <>
            <Tabs tabs={tabs}></Tabs>
        </>
    )
}


interface Tab {
    label: string;
    content: ReactNode;
}

interface TabsProp {
    tabs: Tab[];
}

const Tabs: React.FC<TabsProp> = ({ tabs }) => {
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    const handleTabClick = (index: number) => {
        setActiveTabIndex(index);
    };

    return (
        <div>
            <div className="tab-row">
                {tabs.map((tab, index) => (
                    <button
                        key={index}
                        onClick={() => handleTabClick(index)}
                        className={index === activeTabIndex ? "active" : ""}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div>{tabs[activeTabIndex].content}</div>
        </div>
    );
};
