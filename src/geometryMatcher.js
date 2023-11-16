import { SCHEMA, MAP_MATCHER_URL } from "./constants.js";
import { getKnex } from "./knex.js";

const { knex } = getKnex();

const ROUTE_TYPE_PROFILES = {
  TRAM: "tram",
  L_RAIL: "tram",
  BUS: "bus",
  TRAMBUS: "trambus",
};

const CONSTRUCTION_PROFILE_SUFFIX = "-with-construction";

export const runGeometryMatcher = async (schema = SCHEMA) => {
  const startTime = process.hrtime();

  try {
    console.log("Starting geometry match process.");

    // test that map matcher is up and running
    const serviceOk = (await fetch(MAP_MATCHER_URL)).status === 200;

    if (!serviceOk) {
      console.log("Map-matcher service is not ready. Exiting...");
      return;
    }

    // get original shapes
    const dataResult = await knex.raw("SELECT ??.point_network_as_geojson()", [schema]);
    const shapes = dataResult.rows[0].point_network_as_geojson.features;

    // clear geometry data
    await knex.raw("DELETE FROM ??.geometry", [schema]);

    // Count routes that couldn't be fitted
    let invalidCounter = 0;

    for (const shape of shapes) {
      const routeId = shape.properties.route_id;
      let routeType = shape.properties.mode;
      // Trambus allows route fitting in both normal roads and tram ways. Used for X-lines.
      if (routeId.includes("X") && ["BUS", "TRAM"].includes(routeType)) {
        routeType = "TRAMBUS";
      }

      // Use construction profile if route is not yet in use (dateBegin is in the future)
      const useConstruction = new Date(shape.properties.date_begin) > new Date();
      const profile = ROUTE_TYPE_PROFILES[routeType] + (useConstruction ? CONSTRUCTION_PROFILE_SUFFIX : "");

      let geometry;
      let confidence;
      let fittedDataResult;

      if (profile) {
        // Request fitted geometry from map matcher for the profile
        fittedDataResult = await fetch(`${MAP_MATCHER_URL}match/${profile}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ geometry: shape.geometry }),
        });
      } else {
        fittedDataResult = {
          ok: false,
          status: "NO PROFILE",
          text: () => `No profile for routetype ${routeType}`,
        };
      }

      if (fittedDataResult.ok) {
        const result = await fittedDataResult.json();
        geometry = result.geometry;
        confidence = result.confidence;
      } else {
        // Use original geometry if there were errors.
        invalidCounter++;
        console.warn(
          `Map matching was not successful for ${shape.properties.route_id}_${
            shape.properties.direction
          }. Got status ${
            fittedDataResult.status
          }. Msg: ${await fittedDataResult.text()}`,
        );
        geometry = shape.geometry;
        confidence = 0;
      }

      // save the result
      await knex
        .withSchema(schema)
        .insert({
          route_id: shape.properties.route_id,
          direction: shape.properties.direction,
          date_begin: shape.properties.date_begin,
          date_end: shape.properties.date_end,
          mode: knex.raw("?::??.mode", [shape.properties.mode, schema]),
          geom: knex.raw("ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)", [
            JSON.stringify(geometry),
          ]),
          outliers: 0, // TODO: remove
          min_likelihood: 0, // TODO: remove
          confidence,
        })
        .into("geometry");
    }

    const [execDuration] = process.hrtime(startTime);
    console.log(
      `Geometry matcher finished successfully in ${execDuration} seconds. ${invalidCounter} routes could not be fitted.`,
    );
  } catch (e) {
    const [execDuration] = process.hrtime(startTime);

    console.error(`Geometry matcher failed after running for ${execDuration} seconds.`);
    console.error(e);
  }
};
