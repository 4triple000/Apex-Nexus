// PowerUps.tsx
import React from 'react';

const PowerUps: React.FC<{ onLoot: (type: string) => void }> = ({ onLoot }) => {
  const lootTypes = ['health', 'ammo', 'speed'];

  const dropLoot = () => {
    const randomType = lootTypes[Math.floor(Math.random() * lootTypes.length)];
    onLoot(randomType);
  };

  return <button onClick={dropLoot}>Drop Loot</button>;
};

export default PowerUps;