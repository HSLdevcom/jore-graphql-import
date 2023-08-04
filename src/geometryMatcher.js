import { SCHEMA, MAP_MATCHER_URL } from "./constants";
import { getKnex } from "./knex";

const { knex } = getKnex();

const ROUTE_TYPE_PROFILES = {
  TRAM: "tram",
  L_RAIL: "tram",
  BUS: "bus",
  TRAMBUS: "trambus",
};

export const runGeometryMatcher = async (schema = SCHEMA) => {
  const startTime = process.hrtime();

  try {
    console.log("Starting geometry match process.");

    const serviceOk = (await fetch(MAP_MATCHER_URL)).status === 200;

    if (!serviceOk) {
      console.log("Map-matcher service is not ready. Exiting...");
      return;
    }

    const dataResult = await knex.raw("SELECT ??.point_network_as_geojson()", [schema]);

    const shapes = dataResult.rows[0].point_network_as_geojson.features;

    await knex.raw("DELETE FROM ??.geometry", [schema]);

    await shapes.forEach(async (shape) => {
      const routeId = shape.properties.route_id;
      let routeType = shape.properties.mode;
      // Trambus allows route fitting in both normal roads and tram ways. Used for X-lines.
      if (routeId.includes("X") && ["BUS", "TRAM"].includes(routeType)) {
        routeType = "TRAMBUS";
      }

      const profile = ROUTE_TYPE_PROFILES[routeType];

      let geometry;
      let confidence;

      if (profile) {
        const fittedDataResult = await fetch(`${MAP_MATCHER_URL}match/${profile}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ geometry: shape.geometry }),
        });
        if (fittedDataResult.ok) {
          const result = await fittedDataResult.json();
          geometry = result.geometry;
          confidence = result.confidence;
        } else {
          // Use original geometry if there were errors.
          console.error(
            `Map matching was not successful. Got status ${
              fittedDataResult.status
            }. Body: ${JSON.stringify(await fittedDataResult.json())}`,
          );
          geometry = shape.geometry;
          confidence = 0;
        }

        await knex
          .withSchema(schema)
          .insert({
            route_id: shape.properties.route_id,
            direction: shape.properties.direction,
            date_begin: shape.properties.date_begin,
            date_end: shape.properties.date_end,
            mode: knex.raw("?::??.mode", [shape.properties.mode, schema]),
            geom: knex.raw("ST_GeomFromGeoJSON(?)", [JSON.stringify(geometry)]),
            outliers: 0, // TODO: remove
            min_likelihood: 0, // TODO: remove
            confidence,
          })
          .into("geometry");
      }
    });

    const [execDuration] = process.hrtime(startTime);
    console.log(`Geometry matcher finished successfully in ${execDuration} seconds.`);
  } catch (e) {
    const [execDuration] = process.hrtime(startTime);

    console.error(`Geometry matcher failed after running for ${execDuration} seconds.`);
    console.error(e);
  }
};
