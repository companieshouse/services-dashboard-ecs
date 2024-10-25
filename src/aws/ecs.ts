
// import for AWS sdk
import { ECSClient, ListClustersCommand, ListTasksCommand, DescribeTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-provider-ini";    // (required on local dev)

import * as config from "../config";

// Initialise ECS client with profile from AWS credentials
const client = new ECSClient({
   credentials: fromIni({ profile: config.AWS_PROFILE }),     //(required on local dev)
   region: config.REGION                                      //(required on local dev)
});

// Initialise ECS client with profile from AWS credentials
// const client = new ECSClient();

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

export {listClusters, listTasks, describeTask, describeTaskDefinition}
