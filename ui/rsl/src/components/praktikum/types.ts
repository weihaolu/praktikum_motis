import { Connection } from "@/api/protocol/motis"

export interface Roundtrip {
    startConnection: Connection;
    returnConnection: Connection;
}

export interface OverallDelayDiff {
    aggregatedDelays: {
        overallDelayBefore: number;
        overallDelayAfter: number;
    };
    beforeAfterDelays: ThresholdDataObject;
}

export interface DelayDiff {
    min: OverallDelayDiff;
    max: OverallDelayDiff;
    exp: OverallDelayDiff;
}

export type NumberObject = { [key: string]: number }

export type ThresholdDataObject = { [x: string]: { y1: number, y2: number } }

export interface BeforeAfterDist {
    before: NumberObject
    after: NumberObject
}

export interface BeforeAfterCancel {
    delayDiff: DelayDiff;
    overallCost: number;
    overallCapacityCost: number;
    distDiffs: NumberObject;
    beforeAfterDist: BeforeAfterDist;
}

export interface CancelRoundtripResult {
    canceledRoundtrip: Roundtrip;
    beforeAfter: BeforeAfterCancel;
}

export type DistThresholdData = { x: string, y1: number, y2: number };
