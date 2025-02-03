import { Handler, Context } from 'aws-lambda';

import {fetchClusterImages, updateSingleTask} from "./coreLogic";
import {logger, logErr} from "./utils/logger";
import { isRunningInLambda } from "./utils/envUtils";

// Handler function for Lambda
export const handler: Handler = async (
        event: any,
        context: Context
      ) => {

    try {
        if (event) {
            logger.info(`hanlder triggered by received event:${JSON.stringify(event, null, 2)}`);
            if (event.source === 'aws.ecs' && event['detail-type'] === 'ECS Service Action') {
                // ECS Service Update Event
                const serviceName = event.detail.service;
                const updatedVersion = event.detail.desiredTaskDefinition;

                // Update MongoDB based on ECS event
                await updateSingleTask(updatedVersion);
                logger.info(`Updated ECS service ${serviceName}/version ${updatedVersion}`);

            // } else if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
            } else if (event.action === "scan") {
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
