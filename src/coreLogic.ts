import * as config from "./config/index.js";
import * as mongo from "./mongo/mongo.js";
import {logger, logErr} from "./utils/logger.js";
import pLimit from "p-limit";
import { ECRClient, DescribeImagesCommand } from "@aws-sdk/client-ecr";

/* ─── configuration ──────────────────────────────────────────────────────── */
const environments = ["cidev", "staging", "live"];
// Regex to match semantic-version tags (ex "153.2.17")
const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;

// Regex to match timestamps like yyyy-mm-dd_hh-mm-ss (and capture groups)
const timestampRegex = /(\d{4})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})/;

const client = new ECRClient({ region: config.REGION });
/* ────────────────────────────────────────────────────────────────────────── */

type VersionedMap = {
    [env: string]: {
        version: string;
        timestamp?: Date;
    };
};

// type VersionedMap with "timestamp" removed
type ShortVersionedMap = {
  [env: string]: string;
};

const emptyEnvVersion: ShortVersionedMap = {
  cidev: "",
  staging: "",
  live: "",
};

/**
 * strip "timestamp" and assign version's value directly to the map key's value
 * @param {VersionedMap} map - Versioned map with timestamps
 */
function toShortVersionedMap(map: VersionedMap): ShortVersionedMap {
  return Object.fromEntries(
    Object.entries(map).map(([env, { version }]) => [env, version])
  );
}
/**
 * Get env -> version map from ECR
 * @param {string} repoName - ECR repository name
 */
async function getVersionedEnvMap(repoName: string) {
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

    const result: VersionedMap = {}

    for (const img of allImages) {
        const tags = img.imageTags || [];
        console.log("Repo:", repoName, "Total images found:", allImages.length, "Tags:", tags);

        // All version tags
        const versionTags = tags.filter((t) => versionRegex.test(t));
        if (versionTags.length === 0) continue;

        for (const env of environments) {
            // Look for env tag (case-insensitive)
            const envTag = tags.find((t) =>
                t.toLowerCase().includes(env.toLowerCase())
            );
            if (!envTag) continue;

            // Extract timestamp from env tag if present
            const match = envTag.match(timestampRegex);
            let timestamp = undefined;

            if (match) { // Convert "yyyy-mm-dd_hh-mm-ss" string into Date for comparison
                const isoLike = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
                timestamp = new Date(isoLike);
            }
            for (const version of versionTags) {
                const existing = result[env];
                if (!existing) {
                    result[env] = { version, timestamp };
                } else {
                    // Compare timestamps if both exist
                    if (timestamp && existing.timestamp) {
                        if (timestamp > existing.timestamp) {
                            result[env] = { version, timestamp };
                        }
                    } else if (timestamp && !existing.timestamp) {
                        // prefer timestamped over non-timestamped
                        result[env] = { version, timestamp };
                    }
                }
            }
        }
    }
    // Always return all 3 keys (cidev, staging, live) initialised
    return {
        ...emptyEnvVersion,
        ...toShortVersionedMap(result),
    };
}

/**
 * Get the list of docs and overwrite/add an "ecs" field with the tags from ECR
 */
async function updateECSMongoWithECR() {
  await mongo.init();

  // 1. Get all documents
  const docs = await mongo.getList();

  // 2. try to avoid rate limit threshold (& cap concurrency) for ECR API calls
  const limit = pLimit(5);

  // 3. Init a map with repoName -> ECS info
  const ecsMap = new Map();

  await Promise.all(
    docs.map((doc: any) =>
      limit(async () => {
        try {
          const envMap = await getVersionedEnvMap(doc.name);
          ecsMap.set(doc.name, envMap);
        } catch (err) {
          logErr(err, `Failed to fetch ECR data for repo ${doc.name}:`);
          ecsMap.set(doc.name, emptyEnvVersion);
        }
      })
    )
  );
  // 4. Write ECS info
  await mongo.writeECSinfo(docs, ecsMap);

  mongo.close();
  logger.info("Complete");
}

export { ShortVersionedMap, updateECSMongoWithECR };
