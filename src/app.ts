import { Handler, Context } from 'aws-lambda';

import {fetchClusterImages, updateSingleTask} from "./coreLogic";
import {logger, logErr} from "./utils/logger";
import { isRunningInLambda } from "./utils/envUtils";

// Handler function for Lambda
export const handler: Handler = async (
        event: any,
        context: Context
      ) => {

    logger.info(`event `);
    try {

        if (event.source === 'aws.ecs') {
            // ECS Service Update Event
            const serviceName = event.detail.service;
            const updatedVersion = event.detail.desiredTaskDefinition;

            // Update MongoDB based on ECS event
            await updateSingleTask(updatedVersion);
            console.log(`Updated ECS service ${serviceName}/version ${updatedVersion}`);

        // } else if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
        } else {
            const operation = event.operation;   // custom payload
            if (operation === "scanClusters") {
                fetchClusterImages();
            }
        }
    } catch (error) {
        logErr(error, "Error fetching ECS data:");
    }

    return {};
};

// normal main when running locally
if (!isRunningInLambda()) {
    fetchClusterImages();
}
