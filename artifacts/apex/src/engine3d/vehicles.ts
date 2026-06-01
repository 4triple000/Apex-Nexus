class Vehicle {
    constructor() {
        this.isDriving = false;
    }
    drive() {
        this.isDriving = true;
        // Logic for vehicle controls and camera switch
    }
    exit() {
        this.isDriving = false;
        // Logic for exiting vehicle
    }
}
