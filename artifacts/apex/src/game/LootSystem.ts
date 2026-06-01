// LootSystem.ts
export class LootSystem {
    private lootTable: { item: string; probability: number }[] = [
        { item: 'Health Pack', probability: 0.2 },
        { item: 'Ammo', probability: 0.5 },
        { item: 'Speed Boost', probability: 0.1 }
    ];

    dropLoot() {
        const roll = Math.random();
        let cumulativeProbability = 0;
        for (const loot of this.lootTable) {
            cumulativeProbability += loot.probability;
            if (roll <= cumulativeProbability) {
                console.log(`Dropped: ${loot.item}`);
                // Logic to add the item to the player's inventory
                break;
            }
        }
    }
}