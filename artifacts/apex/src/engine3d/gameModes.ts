enum GameMode {
    SURVIVAL,
    OPEN_WORLD
}
class GameManager {
    currentMode: GameMode;
    switchMode(mode: GameMode) {
        this.currentMode = mode;
        // Logic for switching game modes
    }
}
const gameManager = new GameManager();
