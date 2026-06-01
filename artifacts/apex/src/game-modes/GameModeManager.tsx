import { useState } from 'react';

export const GameModeManager = () => {
  const [currentMode, setCurrentMode] = useState('SURVIVAL');

  const switchMode = (mode) => {
    setCurrentMode(mode);
  };

  return (
    <div>
      <button onClick={() => switchMode('SURVIVAL')}>Survival Mode</button>
      <button onClick={() => switchMode('OPEN_WORLD')}>Open World Mode</button>
    </div>
  );
};