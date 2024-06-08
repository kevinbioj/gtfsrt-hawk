export type HawkVehicleData = {
  ParcNumber: string;
  RouteNumber: string;
  NextStop: string;
  Longitude: string;
  Latitude: string;
  Angle: number;
};

export type HawkTripDetails = {
  Schedule: Array<{
    Rank: number;
    StopName: string;
    StopGraphKey: string;
    Schedule: string;
  }>;
};
