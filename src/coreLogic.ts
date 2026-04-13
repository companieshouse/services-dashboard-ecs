import * as config from "./config/index.js";
import * as mongo from "./mongo/mongo.js";
import type { GitReleasesMap } from "./mongo/mongo";
import {getReleaseDate} from "./git/git.js";
import {logger, logErr} from "./utils/logger.js";
import pLimit from "p-limit";
import { ECRClient, DescribeImagesCommand } from "@aws-sdk/client-ecr";
import calculateImageEnvVersionMap, { ImageEnvsVersionMap } from "./utils/calculateImageEnvVersionMap.js";

const client = new ECRClient({ region: config.REGION });
/* ────────────────────────────────────────────────────────────────────────── */

// type ImageEnvsVersionMap with "deployTime" removed
type ImageEnvsVersionShortMap = {
  [env: string]: {
        version: string;
        gitReleaseDate: Date | null;
    };
};

const EmptyEnvs: ImageEnvsVersionShortMap = {
  cidev: {
    version: "",
    gitReleaseDate: null,
  },
  staging: {
    version: "",
    gitReleaseDate: null,
  },
  live: {
    version: "",
    gitReleaseDate: null,
  },
};


let gitReleasesOld: GitReleasesMap = {}; // previously fetched from Mongo
let gitReleasesNew: GitReleasesMap = {}; // to be saved to Mongo (new/updated entries only: If I keep using the old one, old data are never dismsissed)

/**
 * strip "deployTimes"
 * @param {ImageEnvsVersionMap} map - Versioned map with deployTimes
 */
function toImageEnvsVersionShortMap(map: ImageEnvsVersionMap): ImageEnvsVersionShortMap {
    return Object.fromEntries(
        Object.entries(map).map(([env, { version, gitReleaseDate }]) => [
        env,
        { version, gitReleaseDate },
        ])
    );
}



/**
 * Get env -> version map from ECR
 * @param {string} repoName - ECR repository name
 */
async function getVersionedEnvMap(repoName: string): Promise<ImageEnvsVersionShortMap> {
    let nextToken = undefined;
    const allImages = [];

    // Paginate through images
    do {
        const cmd: DescribeImagesCommand = new DescribeImagesCommand({
        repositoryName: repoName,
        registryId: config.ECR_REGISTRYID,
        nextToken
        });
        const res = await client.send(cmd);
        allImages.push(...(res.imageDetails || []));
        nextToken = res.nextToken;
    } while (nextToken);

    const result: ImageEnvsVersionMap = calculateImageEnvVersionMap(allImages, repoName);

    // Always return all 3 keys (cidev, staging, live) initialised
    return {
        ...EmptyEnvs,
        ...toImageEnvsVersionShortMap(result),
    };
}

/**
 * Add the git release dates to the environment map
 */
async function setGitReleaseDates(envMap: ImageEnvsVersionShortMap, service: string) {
    // Add entry for the service if it doesn't exist
    if (!gitReleasesOld[service]) {
        gitReleasesOld[service] = {};
    }
    if (!gitReleasesNew[service]) {
        gitReleasesNew[service] = {};
    }
    for (const entry of Object.values(envMap)) {
        if (entry.version){
            // If we don't have a release date, fetch and store it
            if (!gitReleasesOld[service][entry.version]) {
                entry.gitReleaseDate = await getReleaseDate(service, entry.version);
                gitReleasesOld[service][entry.version] = entry.gitReleaseDate;
            } else {
                entry.gitReleaseDate = gitReleasesOld[service][entry.version];
            }
            gitReleasesNew[service][entry.version] = entry.gitReleaseDate;
        }
    }
}
/**
 * Get the list of docs and overwrite/add an "ecs" field with the tags from ECR
 */
async function updateECSMongoWithECR() {
  await mongo.init();

  gitReleasesOld = await mongo.fetchGitReleases();
  logger.info("Fetched git releases data for services.");

  // 1. Get all documents
  const docs = await mongo.getServicesList();

  // 2. try to avoid rate limit threshold (& cap concurrency) for ECR API calls
  const limit = pLimit(5);

  // 3. Init a map with repoName -> ECS info
  const ecsMap = new Map();

  await Promise.all(
    docs.map((doc: any) =>
      limit(async () => {
        try {
          const envMap = await getVersionedEnvMap(doc.name);
          await setGitReleaseDates(envMap, doc.name);
          ecsMap.set(doc.name, envMap);
        } catch (err) {
          logErr(err, `Failed to fetch ECR data for repo ${doc.name}:`);
          ecsMap.set(doc.name, EmptyEnvs);
        }
      })
    )
  );
  // 4. Write ECS info
  await mongo.writeECSinfo(docs, ecsMap);
  // 5. Save Git release dates
  await mongo.saveGitReleases(gitReleasesNew);

  mongo.close();
  logger.info("Complete");
}

export { ImageEnvsVersionShortMap, updateECSMongoWithECR };
