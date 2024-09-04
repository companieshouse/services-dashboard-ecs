// import for env vars
// import dotenv from "dotenv";
// import dotenvExpand from "dotenv-expand";

// import for Mongo
import { Db, MongoClient, PushOperator } from "mongodb";


// import for AWS sdk
import { ECSClient, ListClustersCommand, ListTasksCommand, DescribeTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-provider-ini";

// MongoDB configuration
const MONGO_PROTOCOL = process.env.MONGO_PROTOCOL || "mongodb";
const MONGO_USER = process.env.MONGO_USER || "";
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || "";
const MONGO_AUTH = MONGO_USER ? `${MONGO_USER}:${MONGO_PASSWORD}@` : "";
const MONGO_HOST_AND_PORT = process.env.MONGO_HOST_AND_PORT || "";
const MONGO_URI = `${MONGO_PROTOCOL}://${MONGO_AUTH}${MONGO_HOST_AND_PORT}`;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "accounts";
const MONGO_COLLECTION_PROJECTS = process.env.MONGO_COLLECTION_PROJECTS || "projects";

// AWS configuration
const AWS_PROFILE = process.env.AWS_PROFILE || "dev";
const REGION = process.env.AWS_REGION || "eu-west-2";
const ENVIRONMENT = process.env.ENV || "cidev";

// Initialize ECS client with profile from AWS credentials
const client = new ECSClient({
   credentials: fromIni({ profile: AWS_PROFILE }),
   region: REGION
});

async function listClusters(): Promise<string[]> {
   const command = new ListClustersCommand({});
   const response = await client.send(command);
   return response.clusterArns || [];
}

async function listTasks(clusterArn: string): Promise<string[]> {
   const command = new ListTasksCommand({
       cluster: clusterArn,
       desiredStatus: "RUNNING"
   });
   const response = await client.send(command);
   return response.taskArns || [];
}

async function describeTask(clusterArn: string, taskArn: string): Promise<string> {
   const command = new DescribeTasksCommand({
       cluster: clusterArn,
       tasks: [taskArn]
   });
   const response = await client.send(command);
   const taskDefinitionArn = response.tasks?.[0]?.taskDefinitionArn;
   return taskDefinitionArn || '';
}
async function describeTaskDefinition(taskDefinitionArn: string): Promise<( string | undefined )[]> {
   const command = new DescribeTaskDefinitionCommand({
      taskDefinition: taskDefinitionArn
  });
  const response = await client.send(command);
  const images = response.taskDefinition?.containerDefinitions?.map(container => container.image) || [];
  return images;
}

async function saveToMongo(db: Db, image: string | undefined, env: string ) {
   try {
      if (image !== undefined) {
         console.log(`saving to Mongo: ${image}`)
         // regex to capture the name and version
         const regex = /([^/]+):([^:]+)$/;
         const match = image.match(regex);

         if (match) {
            const [_, name, version] = match;

            const collection = db.collection(MONGO_COLLECTION_PROJECTS);

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

async function swapWithTemp (db: Db, env: string, tempEnv: string ) {
   try {
      const collection = db.collection(MONGO_COLLECTION_PROJECTS);
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
      console.error(`Error swappng ${tempEnv} -> ${env}:`, error);
   }
}


async function fetchClusterImages() {
   console.log(`connecting to Mongo: ${MONGO_URI}`)
   const mongoClient = new MongoClient(MONGO_URI);

   try {
      let images: (string | undefined)[];
      await mongoClient.connect();
      const database = mongoClient.db(MONGO_DB_NAME);
      const clusters = await listClusters();

      if (clusters.length === 0) {
          console.log("No clusters found");
          return;
      }
      const tempEnv = `temp${ENVIRONMENT}`;
      for (const clusterArn of clusters) {
          console.log(`Cluster: ${clusterArn}`);
          const tasks = await listTasks(clusterArn);

          if (tasks.length === 0) {
              console.log("  No running tasks");
          } else {
              for (const taskArn of tasks) {
                  const taskDefinitionArn = await describeTask(clusterArn, taskArn);
                  if (taskDefinitionArn) {
                      images = await describeTaskDefinition(taskDefinitionArn);
                      for (const image of images) {
                          console.log(`    Image: ${image}`);
                          await saveToMongo(database, image, tempEnv);
                      }
                  }
              }
          }
      }
      await swapWithTemp(database, ENVIRONMENT, tempEnv);
   } catch (error) {
      console.error("Error fetching ECS data:", error);
   } finally {
      mongoClient.close();
   }
}

fetchClusterImages();
