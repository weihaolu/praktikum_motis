import { sendPaxForecastApplyMeasuresRequest } from "@/api/paxforecast";
import { sendLookupRiBasisRequest } from "@/api/lookup";
import { MeasureUnion, toMeasureWrapper } from "@/data/measures";
import { sendPaxMonForkUniverseRequest, sendPaxMonGroupStatisticsRequest, sendPaxMonDestroyUniverseRequest } from "@/api/paxmon";
import { PaxMonEdgeLoadInfo, PaxMonGroupStatisticsResponse, PaxMonHistogram, PaxMonTripInfo, PaxMonUpdatedTrip } from "@/api/protocol/motis/paxmon";
import { sendRequest } from "@/api/request";
import { Roundtrip } from "./types";
import { MeasureWrapper } from "@/api/protocol/motis/paxforecast";
const time = new Date("Tue Sep 24 2019 02:00:00 GMT+0100");

async function getCancelMeasures(roundTrip: Roundtrip) {
  const startConnection = roundTrip.startConnection;
  const returnConnection = roundTrip.returnConnection;
  const startTripId = startConnection.trips[0].id;
  const returnTripId = returnConnection.trips[0].id;
  const startRiBasisData = await sendLookupRiBasisRequest({ schedule: 0, trip_id: startTripId });
  const returnRiBasisData = await sendLookupRiBasisRequest({ schedule: 0, trip_id: returnTripId });
  const startFahrtData = startRiBasisData.trips[0].fahrt.data;
  const returnFahrtData = returnRiBasisData.trips[0].fahrt.data;
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

async function applyMeasures(measures: MeasureWrapper[], costHeuristic: Function) {
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

  const group_routes_broken = measuresResult.stats.group_routes_broken;
  const updatedTrips = measuresResult.updates.updated_trips;
  const { transformedUpdatedTrips, overallCapacityCost, distDiffs } = getTransformedUpdatedTrips(updatedTrips);
  const aggregatedDelays = getAggregatedDelays(groupStatisticsBeforeMeasure, groupStatisticsAfterMeasure);

  const beforeAfter = { group_routes_broken, transformedUpdatedTrips, groupStatisticsBeforeMeasure, groupStatisticsAfterMeasure, aggregatedDelays, overallCapacityCost, overallCost: costHeuristic(overallCapacityCost, aggregatedDelays), distDiffs };

  await sendPaxMonDestroyUniverseRequest({
    universe: tempUniverse.universe
  });

  return beforeAfter;

}

function getTransformedUpdatedTrips(updatedTrips: PaxMonUpdatedTrip[]) {
  const transformedUpdatedTrips = [];
  let overallCapacityCost = 0;
  const distDiffs: any = {}
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
          const cost = beforeAfterEdgeCost(before_edge, after_edge);
          const truncatedCost = Math.trunc(cost * 100);
          if (truncatedCost !== 0) {
            if (distDiffs[truncatedCost]) {
              distDiffs[truncatedCost]++;
            } else {
              distDiffs[truncatedCost] = 1;
            }
          }

          console.log()
          updatedDists.push({ from, to, before_edge_dist: before_edge.dist, after_edge_dist: after_edge.dist, possibly_over_capacity: after_edge.possibly_over_capacity, capacity, cost });
          overallCapacityCost += cost;
        }
        if (!after_edge) {
          updatedDists.push({ from, to, canceled: true });
        }
      }
    }
    transformedUpdatedTrips.push({ tripId: updatedTrip.tsi.trip, newly_critical_sections: updatedTrip.newly_critical_sections, updatedDists });
  }
  return { transformedUpdatedTrips, overallCapacityCost, distDiffs };
}

function getAggregatedDelays(before: PaxMonGroupStatisticsResponse, after: PaxMonGroupStatisticsResponse) {

  const getAggregatedDelay = (beforeHistogram: PaxMonHistogram, afterHistogram: PaxMonHistogram) => {
    let overallDelayBefore = 0;
    let overallDelayAfter = 0;
    const iterationLength = beforeHistogram.counts.length > afterHistogram.counts.length ? beforeHistogram.counts.length : afterHistogram.counts.length
    for (let i = 0; i < iterationLength; i++) {
      //total "i + min_value" delay of counts[i] people 
      if (beforeHistogram.counts[i]) {
        const beforeDelay = (i + beforeHistogram.min_value) * beforeHistogram.counts[i];
        overallDelayBefore += beforeDelay;
      }
      if (afterHistogram.counts[i]) {
        //total "i + min_value" delay of counts[i] people 
        const afterDelay = (i + afterHistogram.min_value) * afterHistogram.counts[i];
        overallDelayAfter += afterDelay;
      }
    }
    return { overallDelayBefore, overallDelayAfter };
  }

  return {
    min: getAggregatedDelay(before.min_estimated_delay, after.min_estimated_delay),
    max: getAggregatedDelay(before.max_estimated_delay, after.max_estimated_delay),
    exp: getAggregatedDelay(before.expected_estimated_delay, after.expected_estimated_delay)
  }

}

function beforeAfterEdgeCost(before_edge: PaxMonEdgeLoadInfo, after_edge: PaxMonEdgeLoadInfo) {
  const capacity = getCapacity(before_edge, after_edge);
  const before_edge_q95 = before_edge.dist.q95;
  const after_edge_q95 = after_edge.dist.q95;
  if (capacity === 0) {
    return 0;//not sure if this makes sense
  }
  return (after_edge_q95 - before_edge_q95) / capacity
}

//probably the capacity is always the same but just in case
function getCapacity(before_edge: PaxMonEdgeLoadInfo, after_edge: PaxMonEdgeLoadInfo) {
  return (after_edge.capacity === before_edge.capacity) ? after_edge.capacity : (after_edge.capacity + before_edge.capacity) / 2;
}

export const costFunction1 = (capacityCosts: any, _aggregatedDelays: any) => {
  return capacityCosts;
}

const costFunction2 = (_capacityCosts: any, aggregatedDelays: any) => {
  return aggregatedDelays.exp.overallDelayAfter;
}

const costFunction3 = (capacityCosts: any, aggregatedDelays: any) => {
  return aggregatedDelays.exp.overallDelayAfter * capacityCosts;
}

//only possibleAssignments can be made for trips.length number of trips <=> trips.length - 5 trips must be completely canceled
export async function getBestAssignment(trips: any, numberOfCanceledTrips: number, costHeuristic: Function, result: any[] = [], previousMeasures: any[] = []): Promise<any> {
  if (result.length === numberOfCanceledTrips) {
    return result;
  }
  let bestOverallCost = Number.MAX_SAFE_INTEGER;
  let bestBeforeAfter: any;
  let bestIndex: number;
  let currentMeasures: any[] = [];
  for (let i = 0; i < trips.length; i++) {
    const roundTrip = trips[i];
    const { cancelStart, cancelReturn } = await getCancelMeasures(roundTrip);
    currentMeasures = [...previousMeasures, cancelStart, cancelReturn];
    if (!cancelStart || !cancelReturn) {
      console.error(`measrures could not be applied to trip ${JSON.stringify(roundTrip)}`);
      continue;//TODO check if it makes sense to throw
    }

    const beforeAfter = await applyMeasures(currentMeasures, costHeuristic);
    if (beforeAfter?.overallCost! < bestOverallCost) {
      bestBeforeAfter = { beforeAfter, canceledRoundtrip: roundTrip };
      bestIndex = i;
    }
  }
  result.push(bestBeforeAfter);
  return await getBestAssignment(trips.filter((_trip: any, index: number) => index !== bestIndex), numberOfCanceledTrips, costHeuristic, result, currentMeasures);
}

export async function getMockedRoundtrips(
  start_station_id: string,
  time: number,
  result: { startConnection: any, returnConnection: any }[],
): Promise<any> {

  const startStationContent = {
    station_id: start_station_id,
    time,
    "event_count": 100,
    "direction": "LATER",
    "by_schedule_time": true
  };

  const startStationResult = await sendRequest("/railviz/get_station", "RailVizStationRequest", startStationContent);
  const startStationEvents = (startStationResult.content as any).events;
  for (const startStationEvent of startStationEvents) {
    if (startStationEvent.type === "DEP") {
      const connectionContentOfStartStationEvent = startStationEvent.trips[0].id
      if (!Number.isInteger(Number.parseInt(connectionContentOfStartStationEvent.line_id, 10))) {
        continue;
      }
      const connectionResultOfStartStationEvent = await sendRequest("/trip_to_connection", "TripId", connectionContentOfStartStationEvent);
      const stopsOfStartStationConnection = (connectionResultOfStartStationEvent.content as any).stops;
      const firstStopOfStartStationConnection = stopsOfStartStationConnection[0];
      //the first station of this trip must be the start station
      if (firstStopOfStartStationConnection.station.id === start_station_id) {
        const startConnection = connectionResultOfStartStationEvent.content;
        const lastStopOfStartStationConnection = stopsOfStartStationConnection[stopsOfStartStationConnection.length - 1];
        const returnStationId = lastStopOfStartStationConnection.station.id;
        const returnStationContent = {
          station_id: returnStationId,
          time,
          "event_count": 100,
          "direction": "LATER",
          "by_schedule_time": true
        };
        let returnConnection;
        const endStationResult = await sendRequest("/railviz/get_station", "RailVizStationRequest", returnStationContent);
        const endStationEvents = (endStationResult.content as any).events;
        for (const endStationEvent of endStationEvents) {
          if (endStationEvent.type === "DEP") {
            const connectionContentOfEndStationEvent = endStationEvent.trips[0].id
            const connectionResultOfEndStationEvent = await sendRequest("/trip_to_connection", "TripId", connectionContentOfEndStationEvent);
            const stopsOfEndStationConnection = (connectionResultOfEndStationEvent.content as any).stops;
            const firstStopOfEndStationConnection = stopsOfEndStationConnection[0];
            const lastStopOfEndStationConnection = stopsOfEndStationConnection[stopsOfEndStationConnection.length - 1];
            //the first station of this trip must be the return station
            if (firstStopOfEndStationConnection.station.id === returnStationId && lastStopOfEndStationConnection.station.id === start_station_id) {
              returnConnection = connectionResultOfEndStationEvent.content;
              break;
            }
          }
        }
        if (returnConnection) {
          result.push({ startConnection, returnConnection });
        }
      }
    }
  }
  console.log(result);
}
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

