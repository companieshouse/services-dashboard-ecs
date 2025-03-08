import { Db, MongoClient, PushOperator } from "mongodb";

import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils.js";
import * as config from "../config/index.js";
import {logger, logErr} from "../utils/logger.js";
import {getParamStore} from "../aws/ssm.js"
import {getReleaseDate} from "../git/git.js";

let mongoClient: MongoClient;

let database: Db;

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
   }
   catch(error) {
      logErr(error, "Error connecting to Mongo:");
   }
}

function close() {
   mongoClient.close();
}

// example of Image:
// 416670754337.dkr.ecr.eu-west-2.amazonaws.com/identity-verification-api:0.1.90"
async function saveToMongo(image: string | undefined, env: string ) {
   try {
      if (image !== undefined) {
         // regex to capture the name and version
         const regex = /([^/]+):([^:]+)$/;
         const match = image.match(regex);

         if (match) {
            const [_, name, version] = match;

            const collection = database.collection(config.MONGO_COLLECTION_PROJECTS);

            // Check if a document with the specified name exists
            const existingDocument = await collection.findOne({ name });
            if (!existingDocument) {
               logger.info(`No update perfomed for ECS Service "${name}" as it does not match any doc in the collection.`);
               return;
            }
            let date: string|null = null;
            try {
               date = await getReleaseDate(name, version);
               logger.info(`Version ${version} was released on: ${date}`);
            } catch (error) {
               logErr(error, "Error getting GitHub Release info:");
            }
            // Create the update object
            const updateQuery = {
               $addToSet: { [`ecs.${env}`]: { version, date: date ? new Date(date) : null } }
            };

            // If both "ecs" or its subfield "ecs.type" don't exist --> Mongo creates them
            await collection.updateOne(
               { name, [`ecs.${env}.version`]: { $ne: version } }, // Ensure no object with the same version exists
               updateQuery
            );
         }
      }
   }  catch (error) {
         logErr(error, 'Error updating document:');
   }
 }

async function swapWithTemp (env: string, tempEnv: string ) {
   try {
      const collection = database.collection(config.MONGO_COLLECTION_PROJECTS);
      const updateResult = await collection.updateMany(
         { [`ecs.${tempEnv}`]: { $exists: true } },  // Find docs with ecs.tempEnv
         [
            {
               $set: {
                  [`ecs.${env}`]: `$ecs.${tempEnv}`  // Overwrite ecs.env with ecs.tempEnv
               }
            },
            {
               $unset: [`ecs.${tempEnv}`]  // Remove ecs.tempEnv field
            },
            {
               $set: {
                  [`ecs.${env}`]: {
                     $sortArray: {
                        input: `$ecs.${env}`,
                        sortBy: { version: 1 }  // Sort the array by "version" in ascending order
                     }
                  }
               }
            }
         ]
      );
      logger.info(`Successfully swapped ${tempEnv} -> ${env}: matched ${updateResult.matchedCount} / modified ${updateResult.modifiedCount}`);
   } catch (error) {
      logErr(error, `Error swapping ${tempEnv} -> ${env}:`);
   }
}

export { init, close, saveToMongo, swapWithTemp };