
// import for AWS sdk
import { ECSClient, ListClustersCommand, ListTasksCommand, DescribeTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-provider-ini";    // required on local dev only (not in lambda)

import { isRunningInLambda } from "../utils/envUtils";
import {logger, logErr} from "../utils/logger";
import * as config from "../config";


const client = new ECSClient(
      isRunningInLambda() ?
         { region: config.REGION } :
         {
            credentials: fromIni({ profile: config.AWS_PROFILE }),
            region: config.REGION
         }
   );

async function listClusters(): Promise<string[]> {
   logger.info("fetching Clusters List ...");
   try {
       const command = new ListClustersCommand({});
       logger.info("----presend");
       const response = await client.send(command);
       logger.info(`got ${JSON.stringify(response, null, 2)}`);
       return response.clusterArns || [];
   } catch (error) {
       logger.error(`Error fetching clusters: ${(error as Error).message}`);
       throw error;
   }
}

async function listTasks(clusterArn: string): Promise<string[]> {
   try {
      const command = new ListTasksCommand({
         cluster: clusterArn,
         desiredStatus: "RUNNING"
      });
      const response = await client.send(command);
      return response.taskArns || [];
   } catch (error) {
      logger.error(`Error listing tasks for cluster(${clusterArn}): ${(error as Error).message}`);
      throw error;
   }
}

async function describeTask(clusterArn: string, taskArn: string): Promise<string> {
   try {
      const command = new DescribeTasksCommand({
         cluster: clusterArn,
         tasks: [taskArn]
      });
      const response = await client.send(command);
      const taskDefinitionArn = response.tasks?.[0]?.taskDefinitionArn;
      return taskDefinitionArn || '';
   } catch (error) {
      logger.error(`Error describing task [${clusterArn}/${taskArn}]: ${(error as Error).message}`);
      throw error;
   }
}
async function describeTaskDefinition(taskDefinitionArn: string): Promise<( string | undefined )[]> {
   try {
      const command = new DescribeTaskDefinitionCommand({
         taskDefinition: taskDefinitionArn
      });
   const response = await client.send(command);
   const images = response.taskDefinition?.containerDefinitions?.map(container => container.image) || [];
   return images;
   } catch (error) {
      logger.error(`Error describing task definition[${taskDefinitionArn}]: ${(error as Error).message}`);
      throw error;
   }
}

export { listClusters, listTasks, describeTask, describeTaskDefinition }
