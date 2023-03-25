import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import CandidateTile, { CandidateTileProps } from "./CandidateTile";
import { Roundtrip } from "./types";
import FindAssignmentWorker from "./FindAssignment?worker";
import { getApiEndpoint } from "@/api/endpoint";
import { queryKeys } from "@/api/paxmon";
import { PaxMonStatusResponse } from "@/api/protocol/motis/paxmon";
import { useQueryClient } from "@tanstack/react-query";
import { CostFunctions, getBestAssignment } from "./FindAssignment";
import { BeforeAfterView } from "./BeforeAfterView";
import ReactDOM from 'react-dom';
import { Tab, Tabs } from "./Tabs";

export type CostFunctionLabels = { [key in keyof CostFunctions]: string }

export const CostFunctionLabels: CostFunctionLabels = {
    capacity: 'Fokus auf Kapazitäten',
    expDelay: 'Fokus auf Verspätungen',
    capacityTimesExpDelay: 'Fokus auf Kapazitäten und Verspätungen'
}

function CancelRoundtripDetails(): JSX.Element {
    const [setProgress] = (useOutletContext as any)();
    const queryClient = useQueryClient();
    const params = useParams();
    const [candidates, setCandidates] = useState<CandidateTileProps[]>([]);
    const [isOpen, setIsOpen] = useState(-1);
    const [solutionFound, setSolutionsFound] = useState(0);

    if (solutionFound === Object.keys(CostFunctions).length) {
        setProgress(-1);
    }

    const openPopupFactory = (tabIndex = 0) => {
        return () => {
            setIsOpen(tabIndex);
        }
    };

    const closePopup = () => {
        setIsOpen(-1);
    };

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
                    myWorker.onmessage = (m) => {
                        if (m.data.type === 'result') {
                            const result = m.data.result;
                            setCandidates((prevCandidates) => [...prevCandidates, { costFunctionName: costFunctionName as keyof CostFunctions, cancelResult: result }])
                            myWorker.terminate();
                            setSolutionsFound((prev) => prev + 1);
                        }
                        if (m.data.type === 'applyMeasure') {
                            setProgress((prevProgress: number) => prevProgress + 1)
                        }
                    };
                } else {
                    const costFunction = CostFunctions[costFunctionName as keyof CostFunctions];
                    getBestAssignment(roundTrips, cancelRoundTrips, costFunction, systemTime).then(result => {
                        setCandidates((prevCandidates) => [...prevCandidates, { costFunctionName: costFunctionName as keyof CostFunctions, cancelResult: result }])
                    });
                }
            }
        }, [])

        const tabs: Tab[] = candidates.map((candiate) => {
            const content = (<BeforeAfterView canceldRoundTrips={candiate.cancelResult} />);
            const label = CostFunctionLabels[candiate.costFunctionName];
            return { label, content };
        })

        return (<div>
            <span className="font-medium text-2xl">Beste Belegungen:</span>
            {
                candidates && candidates.map((candidate, index) =>
                    <div onClick={openPopupFactory(index)} >
                        <CandidateTile key={index} {...candidate}></CandidateTile>
                    </div>
                )
            }
            {
                candidates && candidates.length > 0 &&
                <Popup isOpen={isOpen !== -1} onClose={closePopup}>
                    <Tabs tabs={tabs} activeTab={isOpen}></Tabs>
                </Popup>
            }

        </div>
        );
    } else {
        return <></>;
    }
}

interface PopupProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const Popup: React.FC<PopupProps> = ({ isOpen, onClose, children }) => {
    const [popupCount, setPopupCount] = useState(0);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleKeyDown);
            setPopupCount(count => count + 1);
        } else {
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
            setPopupCount(count => count - 1);
        }

        return () => {
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
            setPopupCount(count => count - 1);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const style: React.CSSProperties = {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)'
    };

    if (popupCount > 1) {
        style.left = `${(popupCount - 1) * 20}%`;
    } else {
        style.left = '50%';
        style.transform += 'translateX(-50%)';
    }

    return ReactDOM.createPortal(
        <div className="modal-container">
            <div className="modal">
                <button className="close-button" onClick={onClose}>
                    X
                </button>
                {children}
            </div>
            <div className="overlay" onClick={onClose}></div>
        </div>,
        document.body
    );
};


export default CancelRoundtripDetails;