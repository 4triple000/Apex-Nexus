// useZombieAI.ts
import { useEffect, useState } from 'react';

interface Zombie {
  id: number;
  health: number;
  speed: number;
  position: { x: number; y: number; };
  state: 'idle' | 'chase' | 'attack';
}

const useZombieAI = (playerPosition: { x: number; y: number; }, wave: number) => {
  const [zombies, setZombies] = useState<Zombie[]>([]);

  useEffect(() => {
    const spawnZombies = () => {
      const newZombies: Zombie[] = Array.from({ length: 5 + wave * 2 }, (_, i) => ({
        id: i,
        health: 50 + wave * 10,
        speed: 1 + wave * 0.1,
        position: { x: Math.random() * 100, y: Math.random() * 100 },
        state: 'idle',
      }));
      setZombies(newZombies);
    };

    spawnZombies();
  }, [wave]);

  // Add logic for detecting player and changing state

  return zombies;
};

export default useZombieAI;