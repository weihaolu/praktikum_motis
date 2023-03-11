import React, { useEffect, useState } from 'react';
import RoundtripOutline from './Outline';
import './styles.css';
import ReactDOM from 'react-dom';
import { BeforeAfterView } from './BeforeAfterView';

interface LabelProps {
    roundTrips: any[];
}

const CandidateTile: React.FC<LabelProps> = ({ roundTrips }) => {
    const [isOpen, setIsOpen] = useState(false);

    const openPopup = () => {
        setIsOpen(true);
    };

    const closePopup = () => {
        setIsOpen(false);
    };

    return (
        <div className="candiate-tile">
            <div onClick={openPopup} className="small-labels">
                {roundTrips.map((roundTrip, index) => {
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
            <Popup isOpen={isOpen} onClose={closePopup}>
                {<BeforeAfterView canceldRoundTrips={roundTrips} />}
            </Popup>
        </div>
    );
};


interface PopupProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const Popup: React.FC<PopupProps> = ({ isOpen, onClose, children }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.body.style.overflow = 'auto';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
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

export default CandidateTile;