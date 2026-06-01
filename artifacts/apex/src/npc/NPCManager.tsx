import React from 'react';

const NPCManager = () => {
  const npcs = [/* Array of NPCs */];

  return (
    <div className='npc-manager'>
      {npcs.map(npc => (
        <div key={npc.id} className='npc'>/* Render NPC */</div>
      ))}
    </div>
  );
};

export default NPCManager;