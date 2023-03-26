import { Connection } from "@/api/protocol/motis";
import { sendRequest } from "@/api/request";
import { Roundtrip } from "./types";

export async function getMockedRoundtrips(
  start_station_id: string,
  time: number,
): Promise<Roundtrip[]> {

  const startStationContent = {
    station_id: start_station_id,
    time,
    "event_count": 100,
    "direction": "LATER",
    "by_schedule_time": true
  };

  const startStationResult = await sendRequest("/railviz/get_station", "RailVizStationRequest", startStationContent);
  const startStationEvents = (startStationResult.content as any).events;
  const result: Roundtrip[] = [];

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
        const startConnection = connectionResultOfStartStationEvent.content as Connection;
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
              returnConnection = connectionResultOfEndStationEvent.content as Connection;
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
  return result;
}
