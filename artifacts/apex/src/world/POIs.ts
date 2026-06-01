// Points of Interest System
export class POIs {
  private pois: Array<{ position: [number, number, number], icon: string, type: string }>; 

  constructor() {
    this.pois = [];
  }

  public addPOI(position: [number, number, number], icon: string, type: string) {
    this.pois.push({ position, icon, type });
  }

  public getPOIs() {
    return this.pois;
  }
}