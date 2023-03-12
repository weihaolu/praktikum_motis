import { sendPaxForecastApplyMeasuresRequest } from "@/api/paxforecast";
import { sendLookupRiBasisRequest } from "@/api/lookup";
import { MeasureUnion, toMeasureWrapper } from "@/data/measures";
import { sendPaxMonForkUniverseRequest, sendPaxMonGroupStatisticsRequest, sendPaxMonDestroyUniverseRequest } from "@/api/paxmon";
import { PaxMonEdgeLoadInfo, PaxMonGroupStatisticsResponse, PaxMonHistogram, PaxMonStatusResponse, PaxMonTripInfo, PaxMonUpdatedTrip } from "@/api/protocol/motis/paxmon";
import { sendRequest } from "@/api/request";
import { BeforeAfterCancel, BeforeAfterDist, CancelRoundtripResult, DelayDiff, NumberObject, OverallDelayDiff, Roundtrip, ThresholdDataObject } from "./types";
import { MeasureWrapper } from "@/api/protocol/motis/paxforecast";
import { setApiEndpoint } from "@/api/endpoint";
import { RouteData } from "@remix-run/router/dist/utils";

async function getCancelMeasures(roundTrip: Roundtrip, systemTime?: number) {
  const startConnection = roundTrip.startConnection;
  const returnConnection = roundTrip.returnConnection;
  const startTripId = startConnection.trips[0].id;
  const returnTripId = returnConnection.trips[0].id;
  const startRiBasisData = await sendLookupRiBasisRequest({ schedule: 0, trip_id: startTripId });
  const returnRiBasisData = await sendLookupRiBasisRequest({ schedule: 0, trip_id: returnTripId });
  const startFahrtData = startRiBasisData.trips[0].fahrt.data;
  const returnFahrtData = returnRiBasisData.trips[0].fahrt.data;

  const time = systemTime ? new Date(systemTime * 1000) : new Date();

  const shared = {
    recipients: { trips: [], stations: [] },
    time
  };
  const cancelStartMeasure: any = {
    shared,
    data: {
      original_ribasis: startFahrtData,
      canceled_stops: Array(startFahrtData.allFahrtabschnitt.length + 1).fill(
        true //all stops are canceled
      )
    },
    allow_reroute: startRiBasisData.trips.length === 1,
    type: "RtCancelMeasure"
  };
  const cancelReturnMeasure: any = {
    shared,
    data: {
      original_ribasis: returnFahrtData,
      canceled_stops: Array(returnFahrtData.allFahrtabschnitt.length + 1).fill(
        true //all stops are canceled
      ),
    },
    allow_reroute: returnRiBasisData.trips.length === 1,
    type: "RtCancelMeasure"
  };
  return { cancelStart: toMeasureWrapper(cancelStartMeasure), cancelReturn: toMeasureWrapper(cancelReturnMeasure) };
}

async function applyMeasures(measures: MeasureWrapper[], costFunction: Function): Promise<BeforeAfterCancel> {
  const tempUniverse = await sendPaxMonForkUniverseRequest({
    universe: 0,
    fork_schedule: true,
    ttl: 120,
  });

  //get createMeasures
  const groupStatisticsContent = {
    count_passengers: true,
    universe: tempUniverse.universe
  };

  const groupStatisticsBeforeMeasure = await sendPaxMonGroupStatisticsRequest(groupStatisticsContent);

  //run simulation with apply measures request
  const measuresResult = await sendPaxForecastApplyMeasuresRequest({
    universe: tempUniverse.universe,
    measures,
    replace_existing: true,
    preparation_time: 0,
    include_before_trip_load_info: true,
    include_after_trip_load_info: true,
    include_trips_with_unchanged_load: false,
  });

  const groupStatisticsAfterMeasure = await sendPaxMonGroupStatisticsRequest(groupStatisticsContent);
  const groupStatisticsAfterMeasure2 = await sendPaxMonGroupStatisticsRequest(groupStatisticsContent);

  const updatedTrips = measuresResult.updates.updated_trips;
  const { transformedUpdatedTrips, overallCapacityCost, distDiffs, beforeAfterDist } = getTransformedUpdatedTrips(updatedTrips);
  const delayDiff = getDelayDiff(groupStatisticsBeforeMeasure, groupStatisticsAfterMeasure);

  const beforeAfter = { transformedUpdatedTrips, overallCost: costFunction(overallCapacityCost, delayDiff), distDiffs, beforeAfterDist, delayDiff };

  await sendPaxMonDestroyUniverseRequest({
    universe: tempUniverse.universe
  });

  return beforeAfter;
}

function getTransformedUpdatedTrips(updatedTrips: PaxMonUpdatedTrip[]) {
  const transformedUpdatedTrips = [];
  let overallCapacityCost = 0;
  const distDiffs: NumberObject = {};
  const beforeAfterDist: BeforeAfterDist = { before: {}, after: {} };

  for (const updatedTrip of updatedTrips) {
    const updatedDists: any = [];
    if (JSON.stringify(updatedTrip.before_edges) !== JSON.stringify(updatedTrip.after_edges)) {
      //compare dist
      for (const before_edge of updatedTrip.before_edges) {
        const after_edge = updatedTrip.after_edges.find((ae) => JSON.stringify(ae.from) === JSON.stringify(before_edge.from) && JSON.stringify(ae.to) === JSON.stringify(before_edge.to));
        const from = before_edge.from.name;
        const to = before_edge.from.name;
        if (after_edge && JSON.stringify(before_edge.dist) !== JSON.stringify(after_edge.dist)) {
          const capacity = getCapacity(before_edge, after_edge);
          const cost = beforeAfterEdgeCost(before_edge, after_edge, beforeAfterDist);
          setDist(cost, distDiffs);
          overallCapacityCost += cost;

          updatedDists.push({ from, to, before_edge_dist: before_edge.dist, after_edge_dist: after_edge.dist, possibly_over_capacity: after_edge.possibly_over_capacity, capacity, cost });
        }
        if (!after_edge) {
          updatedDists.push({ from, to, canceled: true });
        }
      }
    }
    transformedUpdatedTrips.push({ tripId: updatedTrip.tsi.trip, newly_critical_sections: updatedTrip.newly_critical_sections, updatedDists });
  }
  return { transformedUpdatedTrips, overallCapacityCost, distDiffs, beforeAfterDist };
}

function setDist(dist: number, numberObject: NumberObject, threshold = 0) {
  const truncatedCost = Math.trunc(dist * 100);
  if (truncatedCost > threshold) {
    if (numberObject[truncatedCost]) {
      numberObject[truncatedCost]++;
    } else {
      numberObject[truncatedCost] = 1;
    }
  }
}

function setThresholdData(delay: number, thresholdDataObject: ThresholdDataObject, y = 'y1' || 'y2', counts: number) {
  if (delay !== 0) {
    if (thresholdDataObject[delay]) {
      (thresholdDataObject[delay] as any)[y] = counts;
    } else {
      (thresholdDataObject[delay] as any) = { [y]: counts };
    }
  }
}

function getDelayDiff(before: PaxMonGroupStatisticsResponse, after: PaxMonGroupStatisticsResponse): DelayDiff {
  const getAggregatedDelay = (beforeHistogram: PaxMonHistogram, afterHistogram: PaxMonHistogram) => {
    let overallDelayBefore = 0;
    let overallDelayAfter = 0;
    const beforeAfterDelays: ThresholdDataObject = {};
    const iterationLength = beforeHistogram.counts.length > afterHistogram.counts.length ? beforeHistogram.counts.length : afterHistogram.counts.length
    for (let i = 0; i < iterationLength; i++) {
      //total "i + min_value" delay of counts[i] people 
      if (beforeHistogram.counts[i]) {
        const delayInMinutes = (i + beforeHistogram.min_value);
        const counts = beforeHistogram.counts[i];
        setThresholdData(delayInMinutes, beforeAfterDelays, 'y1', beforeHistogram.counts[i]);
        const beforeDelay = delayInMinutes * counts;
        overallDelayBefore += beforeDelay;
      }
      if (afterHistogram.counts[i]) {
        //total "i + min_value" delay of counts[i] people 
        const delayInMinutes = (i + afterHistogram.min_value);
        const counts = afterHistogram.counts[i];
        setThresholdData(delayInMinutes, beforeAfterDelays, 'y2', counts);
        const afterDelay = delayInMinutes * counts;
        overallDelayAfter += afterDelay;
      }
    }
    return { aggregatedDelays: { overallDelayBefore, overallDelayAfter }, beforeAfterDelays };
  }

  return {
    min: getAggregatedDelay(before.min_estimated_delay, after.min_estimated_delay),
    max: getAggregatedDelay(before.max_estimated_delay, after.max_estimated_delay),
    exp: getAggregatedDelay(before.expected_estimated_delay, after.expected_estimated_delay)
  }

}

function beforeAfterEdgeCost(before_edge: PaxMonEdgeLoadInfo, after_edge: PaxMonEdgeLoadInfo, beforeAfterDist: BeforeAfterDist) {
  const capacity = getCapacity(before_edge, after_edge);
  const before_edge_q95 = before_edge.dist.q95;
  const after_edge_q95 = after_edge.dist.q95;

  if (capacity === 0) {
    return 0;//not sure if this makes sense
  }

  setDist(before_edge_q95 / capacity, beforeAfterDist.before, 80)
  setDist(after_edge_q95 / capacity, beforeAfterDist.after, 80)

  return (after_edge_q95 - before_edge_q95) / capacity
}

//probably the capacity is always the same but just in case
function getCapacity(before_edge: PaxMonEdgeLoadInfo, after_edge: PaxMonEdgeLoadInfo) {
  return (after_edge.capacity === before_edge.capacity) ? after_edge.capacity : (after_edge.capacity + before_edge.capacity) / 2;
}

const capacity = (capacityCosts: number, _delayDiff: DelayDiff) => {
  return capacityCosts;
}

const expDelay = (_capacityCosts: number, delayDiff: DelayDiff) => {
  return delayDiff.exp.aggregatedDelays.overallDelayAfter;
}

const capacityTimesExpDelay = (capacityCosts: number, aggregatedDelays: DelayDiff) => {
  const delay = aggregatedDelays.exp.aggregatedDelays.overallDelayAfter || 0;
  const capacity = capacityCosts || 0;
  return (delay * capacity) / 10000;
}

export type CostFunctions = {
  capacity: (capacityCosts: number, delayDiff: DelayDiff) => number
  expDelay: (capacityCosts: number, delayDiff: DelayDiff) => number
  capacityTimesExpDelay: (capacityCosts: number, delayDiff: DelayDiff) => number
}

export const CostFunctions: CostFunctions = {
  capacity,
  expDelay,
  capacityTimesExpDelay
}

//only possibleAssignments can be made for trips.length number of trips <=> trips.length - 5 trips must be completely canceled
export async function getBestAssignment(trips: any, numberOfCanceledTrips: number, costFunction: Function, systemTime?: number, result: CancelRoundtripResult[] = [], previousMeasures: MeasureWrapper[] = []): Promise<CancelRoundtripResult[]> {
  if (result.length === numberOfCanceledTrips) {
    return result;
  }
  let bestOverallCost = Number.MAX_SAFE_INTEGER;
  let bestBeforeAfter!: CancelRoundtripResult;
  let bestIndex: number;
  let currentMeasures: MeasureWrapper[] = [];
  for (let i = 0; i < trips.length; i++) {
    const roundTrip = trips[i];
    const { cancelStart, cancelReturn } = await getCancelMeasures(roundTrip, systemTime);

    if (!cancelStart || !cancelReturn) {
      console.error(`measrures could not be applied to roundtrip ${JSON.stringify(roundTrip)}`);
      continue;
    }

    currentMeasures = [...previousMeasures, cancelStart, cancelReturn];

    const beforeAfter = await applyMeasures(currentMeasures, costFunction);
    const overallCost = beforeAfter.overallCost;
    const noImprovementFound = i === trips.length - 1 && !bestOverallCost;

    if ((overallCost && !isNaN(overallCost) && overallCost < bestOverallCost) || noImprovementFound) {
      bestOverallCost = overallCost;
      bestBeforeAfter = { beforeAfter, canceledRoundtrip: roundTrip };
      bestIndex = i;
      if (noImprovementFound) {
        console.error(`no improvement found. continuing with suboptimal cancel of roundtrip ${JSON.stringify(roundTrip)}`);
      }
    }
  }

  result.push(bestBeforeAfter);

  return await getBestAssignment(trips.filter((_trip: any, index: number) => index !== bestIndex), numberOfCanceledTrips, costFunction, systemTime, result, currentMeasures);
}

// export async function getMockedRoundtrips(
//   start_station_id: string,
//   time: number,
//   result: { startConnection: any, returnConnection: any }[],
// ): Promise<any> {

//   const startStationContent = {
//     station_id: start_station_id,
//     time,
//     "event_count": 100,
//     "direction": "LATER",
//     "by_schedule_time": true
//   };

//   const startStationResult = await sendRequest("/railviz/get_station", "RailVizStationRequest", startStationContent);
//   const startStationEvents = (startStationResult.content as any).events;
//   for (const startStationEvent of startStationEvents) {
//     if (startStationEvent.type === "DEP") {
//       const connectionContentOfStartStationEvent = startStationEvent.trips[0].id
//       if (!Number.isInteger(Number.parseInt(connectionContentOfStartStationEvent.line_id, 10))) {
//         continue;
//       }
//       const connectionResultOfStartStationEvent = await sendRequest("/trip_to_connection", "TripId", connectionContentOfStartStationEvent);
//       const stopsOfStartStationConnection = (connectionResultOfStartStationEvent.content as any).stops;
//       const firstStopOfStartStationConnection = stopsOfStartStationConnection[0];
//       //the first station of this trip must be the start station
//       if (firstStopOfStartStationConnection.station.id === start_station_id) {
//         const startConnection = connectionResultOfStartStationEvent.content;
//         const lastStopOfStartStationConnection = stopsOfStartStationConnection[stopsOfStartStationConnection.length - 1];
//         const returnStationId = lastStopOfStartStationConnection.station.id;
//         const returnStationContent = {
//           station_id: returnStationId,
//           time,
//           "event_count": 100,
//           "direction": "LATER",
//           "by_schedule_time": true
//         };
//         let returnConnection;
//         const endStationResult = await sendRequest("/railviz/get_station", "RailVizStationRequest", returnStationContent);
//         const endStationEvents = (endStationResult.content as any).events;
//         for (const endStationEvent of endStationEvents) {
//           if (endStationEvent.type === "DEP") {
//             const connectionContentOfEndStationEvent = endStationEvent.trips[0].id
//             const connectionResultOfEndStationEvent = await sendRequest("/trip_to_connection", "TripId", connectionContentOfEndStationEvent);
//             const stopsOfEndStationConnection = (connectionResultOfEndStationEvent.content as any).stops;
//             const firstStopOfEndStationConnection = stopsOfEndStationConnection[0];
//             const lastStopOfEndStationConnection = stopsOfEndStationConnection[stopsOfEndStationConnection.length - 1];
//             //the first station of this trip must be the return station
//             if (firstStopOfEndStationConnection.station.id === returnStationId && lastStopOfEndStationConnection.station.id === start_station_id) {
//               returnConnection = connectionResultOfEndStationEvent.content;
//               break;
//             }
//           }
//         }
//         if (returnConnection) {
//           result.push({ startConnection, returnConnection });
//         }
//       }
//     }
//   }
//   console.log(result);
// }
// getMockedRoundtrips("8000261", Math.round(time.getTime() / 1000), result).then(async () => {
//   console.log(result);
//   const testRoundtrips = result.slice(0, 5);



//   const bestHeuristic1Assignment = await getBestAssignment(testRoundtrips, 2, costFunction1);
//   console.log("best heuristic 1 assignment", bestHeuristic1Assignment);
//   const bestHeuristic2Assignment = await getBestAssignment(testRoundtrips, 2, costFunction2);
//   console.log("best heuristic 2 assignment", bestHeuristic2Assignment);
//   const bestHeuristic3Assignment = await getBestAssignment(testRoundtrips, 2, costFunction3);
//   console.log("best heuristic 3 assignment", bestHeuristic3Assignment);

//   const bestHeuristic1Assignment2 = await getBestAssignment(testRoundtrips.filter((roundTrip: any) => roundTrip !== bestHeuristic1Assignment[0].canceledRoundtrip), 2, costFunction1);
//   console.log("best heuristic 1.2 assignment", bestHeuristic1Assignment2);

// });*/

onmessage = async (e: { data: { roundTrips: Roundtrip, cancelRoundTrips: number, costFunctionName: keyof CostFunctions, apiEndpoint: string, systemTime: number } }) => {
  const { roundTrips, cancelRoundTrips, costFunctionName, apiEndpoint, systemTime } = e.data;
  const costFunction = CostFunctions[costFunctionName];
  setApiEndpoint(apiEndpoint);
  const result = await getBestAssignment(roundTrips, cancelRoundTrips, costFunction, systemTime)
  postMessage(result);
}