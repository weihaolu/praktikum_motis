import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CandidateTile from "./CandidateTile";
import { costFunction1, getBestAssignment } from "./FindAssignment";

function CancelRoundtripDetails(): JSX.Element {
    const params = useParams();
    const [candidates, setCandidates] = useState<any[][]>([]);
    // TODO: validate
    const cancelRoundTripsInfo = JSON.parse(params.cancelRoundTripsInfo || '{}');
    const roundTrips = cancelRoundTripsInfo.roundTrips;
    const cancelRoundTrips = cancelRoundTripsInfo.cancelRoundTrips;
    if (roundTrips !== undefined) {
        useEffect(() => {
            getBestAssignment(roundTrips, cancelRoundTrips, costFunction1).then(result => {
                console.log(result);
                setCandidates([...candidates, result])
            });
        }, [])
        return (<div>
            <span className="font-medium text-2xl">Assignment Candidates:</span>
            {
                candidates && candidates.map((candidate, index) =>
                    <CandidateTile key={index} roundTrips={candidate}></CandidateTile>
                )
            }
        </div>
        );
    } else {
        return <></>;
    }
}

export default CancelRoundtripDetails;