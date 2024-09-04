import { ECSClient, ListClustersCommand, ListTasksCommand, DescribeTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-provider-ini";

// Initialize ECS client with profile from AWS credentials
const AWS_PROFILE = "dev";
const client = new ECSClient({
    credentials: fromIni({ profile: AWS_PROFILE }),
    region: "eu-west-2" // replace with your AWS region
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

async function fetchClusterImages() {
    try {
        const clusters = await listClusters();

        if (clusters.length === 0) {
            console.log("No clusters found");
            return;
        }

        for (const clusterArn of clusters) {
            console.log(`Cluster: ${clusterArn}`);
            const tasks = await listTasks(clusterArn);

            if (tasks.length === 0) {
                console.log("  No running tasks");
            } else {
                for (const taskArn of tasks) {
                    const taskDefinitionArn = await describeTask(clusterArn, taskArn);
                    if (taskDefinitionArn) {
                        const images = await describeTaskDefinition(taskDefinitionArn);
                        for (const image of images) {
                            console.log(`    Image: ${image}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching ECS data:", error);
    }
}

fetchClusterImages();

