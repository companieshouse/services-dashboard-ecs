
// import for AWS sdk
import { ECSClient, ListClustersCommand, ListTasksCommand, DescribeTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-provider-ini";    // required on local dev only (not in lambda)

import { isRunningInLambda } from "../utils/envUtils";
import {logger, logErr} from "../utils/logger";
import * as config from "../config";

import https from "https";

const client = new ECSClient({
      region: config.REGION,
      ...(isRunningInLambda() ? {} : { credentials: fromIni({ profile: config.AWS_PROFILE }) })
      // , logger: console,
});

function _testInternet() {
   return new Promise((resolve, reject) => {
       const req = https.get("https://aws.amazon.com/", (res) => {
           console.log(`Internet test status: ${res.statusCode}`);
           resolve(true);
       });

       req.on("error", (err) => {
           console.error("No internet access:", err);
           reject(err);
       });

       req.setTimeout(5000, () => {
           console.error("Internet test timeout: No response");
           req.destroy();
           reject(new Error("Timeout"));
       });

       req.end();
   });
}


async function testECSConnection(): Promise<number> {
   return new Promise((resolve, reject) => {
       const options = {
           hostname: "ecs.eu-west-2.amazonaws.com",
           port: 443,
           path: "/",
           method: "GET",
       };

       const req = https.request(options, (res) => {
           resolve(res.statusCode || 500); // Default to 500 if status code is undefined
       });

       req.on("error", (error) => {
           reject(`Error connecting to ECS: ${error.message}`);
       });

       req.end();
   });
}

async function _testAWSAPI() {
   return new Promise((resolve, reject) => {
       const req = https.get("https://ecs.eu-west-2.amazonaws.com/", (res) => {
           console.log(`AWS API status code: ${res.statusCode}`);
           resolve(true);
       });

       req.on("error", (err) => {
           console.error("AWS API unreachable:", err);
           reject(err);
       });

       req.end();
   });
}

async function _debug() {
   console.log(`AWS Region: ${config.REGION}`);
   try {
      console.log("testing internet access...");
      await _testInternet();
      await _testAWSAPI();
  } catch (error) {
      console.error("No internet access:", error);
  }
}

async function listClusters(): Promise<string[]> {
   // logger.info("fetching Clusters List ...");
   console.log("1");
   try {
      console.log("1.1");
      const status = await testECSConnection();
      console.log(`Status Code: ${status}`);
      await _debug();

      const command = new ListClustersCommand({});
      console.log("2");
   //  logger.info("----presend");
      const response = await client.send(command);
      // logger.info(`got ${JSON.stringify(response, null, 2)}`);
      console.log(`got ${JSON.stringify(response, null, 2)}`);
      return response.clusterArns || [];
   } catch (error) {
   //  logger.error(`Error fetching clusters: ${(error as Error).message}`);
      console.log("3");
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
