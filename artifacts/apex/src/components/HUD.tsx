// HUD.tsx
import React from 'react';
import HealthBar from './HealthBar';

const HUD: React.FC<{ wave: number; xp: number; health: number; ammo: number; }> = ({ wave, xp, health, ammo }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0 }}>
      <h1>Wave: {wave}</h1>
      <HealthBar health={health} />
      <h2>XP: {xp}</h2>
      <h2>Ammo: {ammo}</h2>
    </div>
  );
};

export default HUD;

// HUD.tsx
import React from 'react';

const HUD: React.FC<{ health: number; level: number; wave: number; xp: number }> = ({ health, level, wave, xp }) => {
    return (
        <div className='hud'>
            <div>Health: {health}</div>
            <div>Level: {level}</div>
            <div>Wave: {wave}</div>
            <div>XP: {xp}</div>
        </div>
    );
};

export default HUD;