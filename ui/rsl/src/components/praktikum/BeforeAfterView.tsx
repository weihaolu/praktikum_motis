import React, { ReactNode, useState } from 'react';

import { TestTheshold } from "./TestThreshold";
import { ThresholdChart } from "./ThresholdChart";
import { CpacityChart } from "./CapacityChart";
import { CancelRoundtripResult, NumberObject } from "./types";


interface BeforeAfterViewProps {
    canceldRoundTrips: CancelRoundtripResult[]
}

export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({ canceldRoundTrips }) => {
    const aggregate = (numberObject: NumberObject, aggregatedResult: NumberObject) => {
        Object.keys(numberObject).forEach(key => {
            if (aggregatedResult[key]) {
                aggregatedResult[key] += numberObject[key];
            } else {
                aggregatedResult[key] = numberObject[key];
            }
        });
    }
    const transFormNumberObjectToXYArray = (numberObject: NumberObject) => Object.entries(numberObject).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10)).map(entry => ({ x: entry[0], y: entry[1] }));
    const transFormNumberObjectsToXYYArray = (numberObject1: NumberObject, numberObject2: NumberObject) => {
        const preResult: {
            [key: string]: { y1: number, y2: number }
        } = {};

        Object.entries(numberObject1).forEach(entry => {
            const x = entry[0];
            const y1 = entry[1];
            const y2 = numberObject2[x] || 0;
            preResult[x] = { y1, y2 };
        });

        Object.entries(numberObject2).forEach(entry => {
            const x = entry[0];
            const y1 = numberObject1[x] || 0;
            const y2 = entry[1];
            preResult[x] = { y1, y2 };
        });

        return Object.entries(preResult).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10)).map(entry => ({ x: entry[0], y1: entry[1].y1, y2: entry[1].y2 }));
    };
    const preDistDiffData: NumberObject = {};
    const preBeforeDistData: NumberObject = {};
    const preAfterDistData: NumberObject = {};

    for (const canceledRoundTrip of canceldRoundTrips) {
        const distDiffs = canceledRoundTrip.beforeAfter.distDiffs;
        aggregate(distDiffs, preDistDiffData);

        const { before, after } = canceledRoundTrip.beforeAfter.beforeAfterDist;
        aggregate(before, preBeforeDistData);
        aggregate(after, preAfterDistData);
    }

    const distDiffData = transFormNumberObjectToXYArray(preDistDiffData);
    const beforeAfterDistData = transFormNumberObjectsToXYYArray(preBeforeDistData, preAfterDistData);

    const width = 700;
    const height = 700;
    const tabs: Tab[] = [
        { label: 'Capacity BarChart', content: (<CpacityChart width={width} height={height} data={distDiffData} />) },
        { label: 'Capacity Threshold', content: (<ThresholdChart width={width} height={height} thresholdDataArray={beforeAfterDistData} />) },
        { label: 'Threshold1', content: (<TestTheshold width={width} height={height} />) }
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
