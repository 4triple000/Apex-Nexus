// GameLoop.tsx
import React, { useState, useEffect } from 'react';

const GameLoop: React.FC = () => {
  const [wave, setWave] = useState(1);
  const [zombieCount, setZombieCount] = useState(5);
  const [playerXP, setPlayerXP] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [health, setHealth] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      if (zombieCount > 0) {
        setZombieCount(prev => prev + wave);
      } else {
        setWave(prev => prev + 1);
        setZombieCount(5 + (prev + 1) * 2);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [zombieCount, wave]);

  const handleZombieKill = () => {
    setPlayerXP(prev => prev + 10);
    if (playerXP >= 100) {
      setPlayerLevel(prev => prev + 1);
      setPlayerXP(0);
    }
  };

  return (
    <div>
      <h1>Wave: {wave}</h1>
      <h2>Zombies Remaining: {zombieCount}</h2>
      <h2>XP: {playerXP} (Level: {playerLevel})</h2>
      <h2>Health: {health}</h2>
    </div>
  );
};

export default GameLoop;