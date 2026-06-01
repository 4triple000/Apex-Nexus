// WaveSystem.ts
import { Zombie } from './Zombie';

export class WaveSystem {
    private waveCount: number = 0;
    private zombieCount: number = 5;
    private interval: NodeJS.Timeout | null = null;

    startNextWave() {
        this.waveCount++;
        this.zombieCount += Math.floor(this.waveCount * 1.5);
        console.log(`Starting Wave ${this.waveCount}: ${this.zombieCount} Zombies`);
        this.spawnZombies();
        this.interval = setTimeout(() => this.startNextWave(), 10000);
    }

    spawnZombies() {
        for (let i = 0; i < this.zombieCount; i++) {
            new Zombie(); // instantiate zombie
        }
    }

    stop() {
        if (this.interval) {
            clearTimeout(this.interval);
        }
    }
}