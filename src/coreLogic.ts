import * as config from "./config/index.js";
import {logger, logErr} from "./utils/logger.js";
import * as mongo from "./mongo/mongo.js";
import * as ecs from "./aws/ecs.js";

// temp environment to store the new data
const tempEnv = `temp${config.ENVIRONMENT}`;

export async function fetchClusterImages() {
   try {
        logger.info("fetching Clusters Images ...");
        let images: (string | undefined)[];
        const clusters = await ecs.listClusters();

        if (clusters.length === 0) {
            logger.info("No clusters found");
            return;
        }
        await mongo.init();

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
        // await mongo.swapWithTemp(config.ENVIRONMENT, tempEnv);
    } catch (error) {
        logErr(error, "Error fetching ECS Cluster data:");
    } finally {
        mongo.close();
    }
}

export async function updateSingleTask(image: string) {
    if (image) {
        try {
            await mongo.init();
            logger.info(`Image: ${image}`);
            await mongo.saveToMongo(image, tempEnv);
            await mongo.swapWithTemp(config.ENVIRONMENT, tempEnv);
        }
        catch (error) {
            logErr(error, "Error fetching ECS Task data:");
        }
        finally {
            mongo.close();
        }
    }
}