import Cron from "croner";
import dayjs from "dayjs";
import dayjsBetweenPlugin from "dayjs/plugin/isBetween";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { parseArgs } from "util";

import { downloadStaticResource } from "~/gtfs/download-resource";
import { encodePayload } from "~/gtfs/encode-payload";
import type {
  Trip,
  TripUpdateEntity,
  VehiclePositionEntity,
} from "~/gtfs/types";
import { wrapEntities } from "~/gtfs/wrap-entities";
import { downloadHawkTripDetails, downloadHawkVehicles } from "~/hawk";
import { parseTime } from "./utils/parse-time";
import { checkCalendar } from "./utils/check-calendar";

dayjs.extend(dayjsBetweenPlugin);

const args = parseArgs({
  args: Bun.argv,
  options: {
    "gtfs-resource-href": {
      type: "string",
      short: "g",
    },
    "hawk-slug": {
      type: "string",
      short: "s",
    },
  },
  strict: true,
  allowPositionals: true,
});

let resource: Trip[] | null = null;
const tripUpdates = new Map<string, TripUpdateEntity>();
const vehiclePositions = new Map<string, VehiclePositionEntity>();

console.log("-- HAWK 2 GTFS-RT --");
await updateGtfsResource();
await updateGtfsRtEntries();

Cron("0 0 * * * *", updateGtfsResource);
Cron("0,30 * * * * *", updateGtfsRtEntries);
Cron("0 * * * * *", sweepEntries);

const app = new Hono();
app.get("/trip-updates", (c) =>
  stream(c, async (stream) => {
    await stream.write(encodePayload(wrapEntities([...tripUpdates.values()])));
  })
);
app.get("/vehicle-positions", (c) =>
  stream(c, async (stream) => {
    await stream.write(
      encodePayload(wrapEntities([...vehiclePositions.values()]))
    );
  })
);

app.get("/trip-updates.json", (c) =>
  c.json(wrapEntities([...tripUpdates.values()]))
);
app.get("/vehicle-positions.json", (c) =>
  c.json(wrapEntities([...vehiclePositions.values()]))
);

export default {
  fetch: app.fetch,
  port: +(Bun.env.PORT ?? 40405),
};

// ---

async function updateGtfsResource() {
  const r = await downloadStaticResource(args.values["gtfs-resource-href"]!);
  resource = r;
  console.log(`Updated GTFS resource at '${new Date().toISOString()}'`);
}

async function updateGtfsRtEntries() {
  if (resource === null) return;
  const vehicles = await downloadHawkVehicles(args.values["hawk-slug"]!);
  const workingTrips = resource.filter((trip) => checkCalendar(trip.calendar));

  for (const vehicle of vehicles) {
    const { Schedule } = await downloadHawkTripDetails(
      args.values["hawk-slug"]!,
      vehicle.ParcNumber
    );

    if (Schedule === null) continue;

    const nextStops = Schedule.slice(
      Schedule.findIndex((s) => s.StopName === vehicle.NextStop)
    );
    const referenceTime = dayjs(nextStops.at(0)?.Schedule, "HH:mm");

    const trip = workingTrips
      .filter(
        (t) =>
          // t.route.name === vehicle.RouteNumber &&
          // Check for first stop
          t.stops.at(0)!.sequence === Schedule.at(0)!.Rank &&
          t.stops.at(0)!.stop.code === Schedule.at(0)!.StopGraphKey &&
          // Check for last stop
          t.stops.at(-1)!.sequence === Schedule.at(-1)!.Rank &&
          t.stops.at(-1)!.stop.code === Schedule.at(-1)!.StopGraphKey &&
          // Check if next stop exists
          t.stops.some((s) => s.stop.code === nextStops.at(0)?.StopGraphKey)
      )
      .sort((a, b) => {
        const aStopTime = parseTime(
          a.stops.find((s) => s.stop.code === nextStops.at(0)!.StopGraphKey)!
            .time
        );
        const bStopTime = parseTime(
          b.stops.find((s) => s.stop.code === nextStops.at(0)!.StopGraphKey)!
            .time
        );
        return (
          Math.abs(referenceTime.diff(aStopTime)) -
          Math.abs(referenceTime.diff(bStopTime))
        );
      })
      .at(0);
    if (typeof trip === "undefined") continue;

    const now = dayjs().unix();
    const tripDescriptor = {
      routeId: trip.route.id,
      directionId: trip.direction,
      tripId: trip.id,
      scheduleRelationship: "SCHEDULED" as const,
    };
    const vehicleDescriptor = {
      id: vehicle.ParcNumber,
      label: vehicle.ParcNumber,
    };
    tripUpdates.set(`SM:${trip.id}`, {
      id: `SM:${trip.id}`,
      tripUpdate: {
        stopTimeUpdate: nextStops.map((nextStop) => {
          const stopTime = trip.stops.find(
            (s) => s.sequence === nextStop.Rank
          )!;
          const stopTimeDescriptor = {
            stopId: stopTime.stop.id,
            stopSequence: nextStop.Rank,
          };
          return {
            ...(stopTime.sequence > 1
              ? {
                  arrival: {
                    time: dayjs(nextStop.Schedule, "HH:mm").unix().toString(),
                  },
                }
              : {}),
            ...(stopTime.sequence < trip.stops.length
              ? {
                  departure: {
                    time: dayjs(nextStop.Schedule, "HH:mm").unix().toString(),
                  },
                }
              : {}),
            ...stopTimeDescriptor,
            scheduleRelationship: "SCHEDULED" as const,
          };
        }),
        timestamp: now,
        trip: tripDescriptor,
        vehicle: vehicleDescriptor,
      },
    });
    const nextStopSequence = nextStops.find(
      (s) => s.StopGraphKey === nextStops.at(0)!.StopGraphKey
    )!.Rank;
    vehiclePositions.set(`VM:${vehicle.ParcNumber}`, {
      id: `VM:${vehicle.ParcNumber}`,
      vehicle: {
        currentStatus: "IN_TRANSIT_TO",
        currentStopSequence: nextStopSequence,
        position: {
          latitude: +vehicle.Latitude,
          longitude: +vehicle.Longitude,
          bearing: vehicle.Angle,
        },
        stopId: trip.stops.find((s) => s.sequence === nextStopSequence)?.stop.id,
        timestamp: now,
        trip: tripDescriptor,
        vehicle: vehicleDescriptor,
      },
    });
  }
  console.log(`Updated GTFS-RT entries at '${new Date().toISOString()}'`);
}

function sweepEntries() {
  tripUpdates.forEach((tripUpdate) => {
    if (
      dayjs().diff(dayjs.unix(tripUpdate.tripUpdate.timestamp), "minutes") >= 10
    ) {
      tripUpdates.delete(tripUpdate.id);
    }
  });
  vehiclePositions.forEach((vehiclePosition) => {
    if (
      dayjs().diff(dayjs.unix(vehiclePosition.vehicle.timestamp), "minutes") >=
      10
    ) {
      vehiclePositions.delete(vehiclePosition.id);
    }
  });
  console.log(`Swept outdated entries at '${new Date().toISOString()}'`);
}
