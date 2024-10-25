// import for env vars
// import dotenv from "dotenv";
// import dotenvExpand from "dotenv-expand";

import * as config from "./config";
import {logger, logErr} from "./utils/logger";
import * as mongo from "./mongo/mongo";
import * as ecs from "./aws/ecs";


async function fetchClusterImages() {   //(required on local dev)
// export const handler = async (): Promise<void> => {

   try {
      let images: (string | undefined)[];
      const clusters = await ecs.listClusters();

      if (clusters.length === 0) {
          logger.info("No clusters found");
          return;
      }
      await mongo.init();

      const tempEnv = `temp${config.ENVIRONMENT}`;
      for (const clusterArn of clusters) {
          logger.info(`Cluster: ${clusterArn}`);
          const tasks = await ecs.listTasks(clusterArn);

          if (tasks.length === 0) {
              logger.info("  No running tasks");
          } else {
              for (const taskArn of tasks) {
                  const taskDefinitionArn = await ecs.describeTask(clusterArn, taskArn);
                  if (taskDefinitionArn) {
                      images = await ecs.describeTaskDefinition(taskDefinitionArn);
                      for (const image of images) {
                          logger.info(`    Image: ${image}`);
                          await mongo.saveToMongo(image, tempEnv);
                      }
                  }
              }
          }
      }
      await mongo.swapWithTemp(config.ENVIRONMENT, tempEnv);
   } catch (error) {
      logErr(error, "Error fetching ECS data:");
   } finally {
      mongo.close();
   }
}
//;

fetchClusterImages();   //(required on local dev)
