import React from 'react';
import { ThresholdChart } from "./ThresholdChart";
import { CpacityChart } from "./CapacityChart";
import { CancelRoundtripResult, NumberObject, ThresholdDataObject } from "./types";
import { Tab, Tabs } from './Tabs';


interface BeforeAfterViewProps {
    canceldRoundTrips: CancelRoundtripResult[]
}

export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({ canceldRoundTrips }) => {

    const transformNumberObjectToXYArray = (numberObject: NumberObject) => Object.entries(numberObject).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10)).map(entry => ({ x: entry[0], y: entry[1] }));
    const transformThresholdObjectToThresholdArray = (thresholdDataObject: ThresholdDataObject) => Object.entries(thresholdDataObject).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10)).map(entry => ({ x: entry[0], y1: entry[1].y1 || 0, y2: entry[1].y2 || 0 }));
    const transformNumberObjectsToThresholdArray = (numberObject1: NumberObject, numberObject2: NumberObject) => {
        const preResult: ThresholdDataObject = {};

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

        return transformThresholdObjectToThresholdArray(preResult);
    };

    const lastCanceledTrip = canceldRoundTrips[canceldRoundTrips.length - 1];//the before after data here already considers the previous measures as they are applied on the same universe at the same time
    const distDiffData = transformNumberObjectToXYArray(lastCanceledTrip.beforeAfter.distDiffs);
    const beforeAfterDistData = transformNumberObjectsToThresholdArray(lastCanceledTrip.beforeAfter.beforeAfterDist.before, lastCanceledTrip.beforeAfter.beforeAfterDist.after);
    const beforeAfterDelayData = transformThresholdObjectToThresholdArray(lastCanceledTrip.beforeAfter.delayDiff.exp.beforeAfterDelays);

    const width = 1000;
    const height = 700;
    const tabs: Tab[] = [
        { label: 'Auslastungserhöhungen', content: (<CpacityChart width={width} height={height} data={distDiffData} />) },
        { label: 'Auslastungsvergleich', content: (<ThresholdChart width={width} height={height} thresholdDataArray={beforeAfterDistData} xLabel={'Auslastung in %'} yLabel={'Anzahl'} />) },
        { label: 'Verspätungsvergleich', content: (<ThresholdChart width={width} height={height} thresholdDataArray={beforeAfterDelayData} xLabel={'Verspätung in Min'} yLabel={'Anzahl'} />) },
    ]

    return (
        <>
            <Tabs tabs={tabs}></Tabs>
        </>
    )
}
