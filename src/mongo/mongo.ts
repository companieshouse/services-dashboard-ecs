import { Collection, Db, MongoClient, PushOperator } from "mongodb";

import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils.js";
import * as config from "../config/index.js";
import {logger, logErr} from "../utils/logger.js";
import {getParamStore} from "../aws/ssm.js"
import {ShortVersionedMap} from "../coreLogic.js"

let mongoClient: MongoClient;

let database: Db;
let collection: Collection

// cache release dates already retrieved from GitHub (ex. eric is looked-up many times)
const cacheReleaseDates: Record<string, string | null> = {};

/**
 * Init MongoDB connection
 */
async function init() {
   try {
      if (!mongoClient) {

         const mongoPassword = isRunningInLambda() ?
            await getParamStore(config.MONGO_PASSWORD_PARAMSTORE_NAME):
            getEnvironmentValue("MONGO_PASSWORD");
         const mongoUri = `${config.MONGO_PROTOCOL}://${config.MONGO_USER}:${mongoPassword}@${config.MONGO_HOST_AND_PORT}`;
         logger.info(`connecting to Mongo: ${mongoPassword ? mongoUri.replace(mongoPassword, 'xxxxx') : mongoUri}`);
         mongoClient = new MongoClient(mongoUri);
      }
      await mongoClient.connect();
      database = mongoClient.db(config.MONGO_DB_NAME);
      collection = database.collection(config.MONGO_COLLECTION_PROJECTS);
   }
   catch(error) {
      logErr(error, "Error connecting to Mongo:");
   }
}

/**
 * Close MongoDB connection
 */
function close() {
   mongoClient.close();
}

/**
 * Get the list of docs (mainly just the "name")
 */
async function getList () {
   return await collection.find({}, { projection: { _id: 1, name: 1 } }).toArray();
}

/**
 * Add the "ecs" field (across the whole collection as bulk operation)
 */
async function writeECSinfo (docs: any[], ecsMap: Map<string, ShortVersionedMap>) {
  // Build bulk updates
  const bulkOps = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { ecs: ecsMap.get(doc.name) } },
    },
  }));

  if (bulkOps.length > 0) {
    const res = await collection.bulkWrite(bulkOps);
    logger.info(`Updated ${res.modifiedCount} documents with ecs field`);
  }
}

export { init, close, getList, writeECSinfo };
