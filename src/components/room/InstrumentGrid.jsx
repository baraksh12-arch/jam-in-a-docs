import React from 'react';
import InstrumentPanel from './InstrumentPanel';

const INSTRUMENTS = ['DRUMS', 'BASS', 'EP', 'GUITAR'];

export default function InstrumentGrid({ players, currentPlayer, audioEngine, sendNote, room }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
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
          />
        );
      })}
    </div>
  );
}