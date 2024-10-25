import { Db, MongoClient, PushOperator } from "mongodb";

import * as config from "../config";

let mongoClient: MongoClient;
let database: Db;

async function init() {
    try {
        console.log(`connecting to Mongo: ${config.MONGO_URI}`)
        mongoClient = new MongoClient(config.MONGO_URI);

        await mongoClient.connect();
        database = mongoClient.db(config.MONGO_DB_NAME);
    }
    catch(error) {
        console.error("Error connecting to Mongo:", error);
    }
}

function close() {
    mongoClient.close();
}

async function saveToMongo(image: string | undefined, env: string ) {
    try {
       if (image !== undefined) {
          // console.log(`saving to Mongo: ${image}`)
          // regex to capture the name and version
          const regex = /([^/]+):([^:]+)$/;
          const match = image.match(regex);
 
          if (match) {
             const [_, name, version] = match;
 
             const collection = database.collection(config.MONGO_COLLECTION_PROJECTS);
 
             // Check if a document with the specified name exists
             const existingDocument = await collection.findOne({ name });
             if (!existingDocument) {
                console.log(`No update perfomed for ECS Service "${name}" as it does not match any doc in the collection.`);
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
       console.error('Error updating document:', error);
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
       console.log(`Successfully swapped ${tempEnv} -> ${env}: matched ${updateResult.matchedCount} / modified ${updateResult.modifiedCount}`);
    } catch (error) {
       console.error(`Error swapping ${tempEnv} -> ${env}:`, error);
    }
 }

 export { init, close, saveToMongo, swapWithTemp };