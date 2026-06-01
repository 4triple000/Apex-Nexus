// Vehicle System Implementation
export class Vehicle {
  private position: [number, number];

  constructor() {
    this.position = [0, 0];
  }

  public drive(direction: 'FORWARD' | 'BACKWARD') {
    // Logic to move vehicle based on input
  }

  public exit() {
    // Logic to exit the vehicle
  }
}