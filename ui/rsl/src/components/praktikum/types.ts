import { Connection } from "@/api/protocol/motis"

export interface Roundtrip {
    startConnection: Connection
    returnConnection: Connection
}

export interface CancelRoundtripResult {

}