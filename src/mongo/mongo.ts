import { Db, MongoClient, PushOperator } from "mongodb";

import * as config from "../config";
import {logger, logErr} from "../utils/logger";


const mongoClient = new MongoClient(config.MONGO_URI);

let database: Db;

async function init() {
    try {
        logger.info(`connecting to Mongo: ${config.MONGO_URI}`)
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

async function saveToMongo(image: string | undefined, env: string ) {
    try {
       if (image !== undefined) {
          // logger.info(`saving to Mongo: ${image}`)
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
 
             // Create the update object
             const updateQuery = {
                $addToSet: { [`ecs.${env}`]: version }  // $addToSet ensures that the value is added only if it doesn't exist
             };
             // If both "ecs" or its subfield "ecs.type" don't exist --> Mongo creates them
             await collection.updateOne({ name }, updateQuery);
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
            { [`ecs.${tempEnv}`]: { $exists: true } },  // find docs with ecs.temp
            [
             {
                 $set: {
                     [`ecs.${env}`]: `$ecs.${tempEnv}`  // Overwrite ecs.env with the value of ecs.tempEnv
                 }
             },
             {
                 $unset: [`ecs.${tempEnv}`]  // Remove the ecs.tempEnv field
             }
         ]
       );
       logger.info(`Successfully swapped ${tempEnv} -> ${env}: matched ${updateResult.matchedCount} / modified ${updateResult.modifiedCount}`);
    } catch (error) {
       logErr(error, `Error swapping ${tempEnv} -> ${env}:`);
    }
 }

 export { init, close, saveToMongo, swapWithTemp };