import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CandidateTile, { CandidateTileProps } from "./CandidateTile";
import { CancelRoundtripResult, Roundtrip } from "./types";
import FindAssignmentWorker from "./FindAssignment?worker";
import { getApiEndpoint } from "@/api/endpoint";
import { queryKeys } from "@/api/paxmon";
import { PaxMonStatusResponse } from "@/api/protocol/motis/paxmon";
import { useQueryClient } from "@tanstack/react-query";
import { CostFunctions, getBestAssignment } from "./FindAssignment";

function CancelRoundtripDetails(): JSX.Element {
    const queryClient = useQueryClient();
    const params = useParams();
    const [candidates, setCandidates] = useState<CandidateTileProps[]>([]);

    const cancelRoundTripsInfo = JSON.parse(params.cancelRoundTripsInfo || '{}');
    const roundTrips: Roundtrip[] = cancelRoundTripsInfo.roundTrips;
    const cancelRoundTrips: number = cancelRoundTripsInfo.cancelRoundTrips;
    const useWorker: boolean = cancelRoundTripsInfo.useWorker;
    const systemTime = queryClient.getQueryData<PaxMonStatusResponse>(
        queryKeys.status(0)
    )?.system_time;

    if (roundTrips !== undefined) {
        useEffect(() => {
            for (const costFunctionName of Object.keys(CostFunctions)) {
                if (useWorker) {
                    const myWorker = new FindAssignmentWorker();
                    myWorker.postMessage({ roundTrips, cancelRoundTrips, costFunctionName, apiEndpoint: getApiEndpoint(), systemTime });
                    myWorker.onmessage = (e) => {
                        const result = e.data;
                        setCandidates((prevCandidates) => [...prevCandidates, { costFunctionName: costFunctionName as keyof CostFunctions, cancelResult: result }])
                        myWorker.terminate();
                    }
                } else {
                    const costFunction = CostFunctions[costFunctionName as keyof CostFunctions];
                    getBestAssignment(roundTrips, cancelRoundTrips, costFunction, systemTime).then(result => {
                        setCandidates((prevCandidates) => [...prevCandidates, { costFunctionName: costFunctionName as keyof CostFunctions, cancelResult: result }])
                    });
                }
            }
        }, [])
        return (<div>
            <span className="font-medium text-2xl">Beste Belegungen:</span>
            {
                candidates && candidates.map((candidate, index) =>
                    <CandidateTile key={index} {...candidate}></CandidateTile>
                )
            }
        </div>
        );
    } else {
        return <></>;
    }
}

export default CancelRoundtripDetails;