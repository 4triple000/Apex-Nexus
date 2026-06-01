// Zombie.ts
class Zombie {
    private state: 'idle' | 'chase' | 'attack' = 'idle';
    private speed: number = 1;
    private health: number = 50;
    private detectionRadius: number = 5;

    constructor() {
        this.initializeAI();
    }

    initializeAI() {
        // Logic for pathfinding and state management
    }

    update(playerPosition: { x: number; y: number }) {
        const distance = this.calculateDistance(playerPosition);
        if (distance < this.detectionRadius) {
            this.state = 'chase';
            this.speed = 2;
            this.chasePlayer(playerPosition);
        } else {
            this.state = 'idle';
            this.speed = 1;
        }
    }

    calculateDistance(playerPosition: { x: number; y: number }): number {
        // Calculate distance logic here
        return 0;
    }

    chasePlayer(playerPosition: { x: number; y: number }) {
        // Chase logic here
    }
}