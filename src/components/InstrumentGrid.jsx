import React from 'react';
import InstrumentPanel from './InstrumentPanel';

const INSTRUMENTS = ['DRUMS', 'BASS', 'EP', 'GUITAR'];

export default function InstrumentGrid({ players, currentPlayer, audioEngine, sendNote, room, activityTriggersRef }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {INSTRUMENTS.map(instrument => {
        const player = players.find(p => p.instrument === instrument);
        const isMyInstrument = currentPlayer?.instrument === instrument;

        return (
          <InstrumentPanel
            key={instrument}
            instrument={instrument}
            player={player}
            isMyInstrument={isMyInstrument}
            audioEngine={audioEngine}
            sendNote={sendNote}
            isPlaying={room?.isPlaying}
            onActivity={(triggerFn) => {
              if (activityTriggersRef.current) {
                activityTriggersRef.current[instrument] = triggerFn;
              }
            }}
          />
        );
      })}
    </div>
  );
}