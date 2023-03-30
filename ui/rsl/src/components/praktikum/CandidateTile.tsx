import React from 'react';
import './styles.css';
import { CancelRoundtripResult } from './types';
import { CostFunctions } from './FindAssignment';
import { CostFunctionLabels } from './CancelRoundtripsDetails';

export interface CandidateTileProps { costFunctionName: keyof CostFunctions, cancelResult: CancelRoundtripResult[] }

const CandidateTile: React.FC<CandidateTileProps> = ({ costFunctionName, cancelResult }) => {
    const lastRoundtrip = cancelResult[cancelResult.length - 1];
    const { overallDelayAfter } = lastRoundtrip.beforeAfter.delayDiff.exp.aggregatedDelays;
    const overallCapacityCost = lastRoundtrip.beforeAfter.overallCapacityCost;

    return (
        <div className="candiate-tile">
            <h1><b>{CostFunctionLabels[costFunctionName]}</b></h1>
            <h2>Insgesamte Auslastungserhöhung: {Math.trunc(overallCapacityCost * 100)}%</h2>
            <h2>Insgesamte Verspätung: {overallDelayAfter} Minuten</h2>
            <div className="small-labels">
                {cancelResult.map((roundTrip, index) => {
                    const { startConnection, returnConnection } = roundTrip.canceledRoundtrip;
                    const startTripId = startConnection.trips[0].id;
                    const returnTripId = returnConnection.trips[0].id;
                    return (
                        <React.Fragment key={index}>
                            <div>
                                <label>Umlauf:</label>
                                <div className="small-label">Zugnummer: {startTripId.train_nr}</div>
                                <div className="small-label">Zugnummer: {returnTripId.train_nr}</div>
                            </div>
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    );
};

export default CandidateTile;