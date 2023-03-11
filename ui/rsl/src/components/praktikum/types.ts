import { Connection } from "@/api/protocol/motis"

export interface Roundtrip {
    startConnection: Connection;
    returnConnection: Connection;
}

export interface OverallDelayDiff {
    overallDelayBefore: number;
    overallDelayAfter: number;
}

export interface AggregatedDelays {
    min: OverallDelayDiff;
    max: OverallDelayDiff;
    exp: OverallDelayDiff;
}

export type NumberObject = { [key: string]: number }

export interface BeforeAfterDist {
    before: NumberObject
    after: NumberObject
}

export interface BeforeAfterCancel {
    aggregatedDelays: AggregatedDelays;
    overallCost: number;
    distDiffs: NumberObject;
    beforeAfterDist: BeforeAfterDist;
}

export interface CancelRoundtripResult {
    canceledRoundtrip: Roundtrip;
    beforeAfter: BeforeAfterCancel;
}

export type DistThresholdData = { x: string, y1: number, y2: number };
