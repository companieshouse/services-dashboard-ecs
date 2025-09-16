import { Collection, Db, MongoClient, ObjectId, ClientSession } from "mongodb";

import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils.js";
import * as config from "../config/index.js";
import {logger, logErr} from "../utils/logger.js";
import {getParamStore} from "../aws/ssm.js"
import {ImageEnvsVersionShortMap} from "../coreLogic.js"

let mongoClient: MongoClient;

let database: Db;
let collectionProject: Collection
let collectionConfig: Collection
let mongoSession: ClientSession;

// Define GitReleasesMap type
export type GitReleasesMap = {
  [service: string]: {
    [version: string]: Date | null;
  };
};

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
      collectionProject = database.collection(config.MONGO_COLLECTION_PROJECTS);
      collectionConfig = database.collection(config.MONGO_COLLECTION_CONFIG!);

      mongoSession = mongoClient.startSession();
   }
   catch(error) {
      logErr(error, "Error connecting to Mongo:");
   }
}

/**
 * Close MongoDB connection
 */
async function close() {
   try {
      await mongoSession.endSession();
      await mongoClient.close();
      logger.info("Mongo connection closed.");
   } catch (error) {
      logger.error(`Error closing Mongo connection: ${(error as Error).message}`);
   }
}

/**
 * Get the list of docs (mainly just the "name")
 */
async function getServicesList () {
   return await collectionProject.find({}, { projection: { _id: 1, name: 1 } }).toArray();
}

/**
 * Add the "ecs" field (across the whole collection as bulk operation)
 */
async function writeECSinfo (docs: any[], ecsMap: Map<string, ImageEnvsVersionShortMap>) {
  // Build bulk updates
  const bulkOps = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { ecs: ecsMap.get(doc.name) } },
    },
  }));

  if (bulkOps.length > 0) {
    const res = await collectionProject.bulkWrite(bulkOps);
    logger.info(`Updated ${res.modifiedCount} documents with ecs field`);
  }
}

async function fetchGitReleases(): Promise<GitReleasesMap> {
   try {
      const doc = await collectionConfig.findOne(
         { _id: config.MONGO_CONFIG_SINGLETON as any },
         { projection: { gitReleases: 1, _id: 0 }, session: mongoSession }
      );
      logger.info("Git releases data fetched successfully.");
      return doc?.gitReleases ?? {};

   } catch (error) {
      logErr(error, "Error fetching Releases Data:");
      return {};
   }
}

async function saveGitReleases(gitReleases: GitReleasesMap) {
   try {
      await collectionConfig.updateOne(
         { _id: config.MONGO_CONFIG_SINGLETON as any },
         { $set: { gitReleases } },
         { session: mongoSession }
      );
    logger.info("Git releases data saved successfully.");
   } catch (error) {
      logErr(error, "Error Updating Releases Data:");
   }
}

export { init, close, getServicesList, writeECSinfo, fetchGitReleases, saveGitReleases };
