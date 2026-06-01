// Player.ts
class Player {
    private health: number = 100;
    private xp: number = 0;
    private level: number = 1;

    constructor() { }

    takeDamage(amount: number) {
        this.health -= amount;
        this.checkHealth();
    }

    checkHealth() {
        if (this.health <= 0) {
            console.log('Game Over');
            // Handle game over logic
        }
    }

    gainXP(amount: number) {
        this.xp += amount;
        if (this.xp >= 100) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp = 0;
        console.log(`Level Up! Now Level ${this.level}`);
    }
}