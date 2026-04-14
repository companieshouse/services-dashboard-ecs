import { ImageDetail } from "@aws-sdk/client-ecr";
import { logger } from "./logger";

// Regex to match semantic-version tags (ex "153.2.17")
const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;

// Regex to match Deploy timestamps like yyyy-mm-dd_hh-mm-ss (and capture groups)
const deployTimeRegex = /(\d{4})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})[^\d](\d{2})/;

const environments = ["cidev", "staging", "live", "rebel1", "phoenix"];

export type ImageEnvsVersionMap = {
    [env: string]: {
        version: string;
        deployTime?: Date;
        gitReleaseDate: Date | null;
        isCurrent?: boolean;
    };
};

export function calculateDeployTimeFromTag(envTag: string): Date | undefined {
    // Extract timestamp from env tag if present
    const match = envTag.match(deployTimeRegex);

    if (match) { // Convert "yyyy-mm-dd_hh-mm-ss" string into Date for comparison
        const isoLike = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
        return new Date(isoLike);
    }

    return undefined;
}

export default function calculateImageEnvVersionMap(allImages: ImageDetail[], repoName: string): ImageEnvsVersionMap {
    const result: ImageEnvsVersionMap = {};

    for (const img of allImages) {
        const tags = img.imageTags || [];
        logger.info(`Repo: ${repoName}, Total images found: ${allImages.length}, Tags: ${tags}`);

        // All version tags
        const versionTags = tags.filter((t) => versionRegex.test(t));
        if (versionTags.length === 0) continue;

        for (const env of environments) {
            const currentEnvTag = tags.find((t) =>
                t.toLowerCase().includes(env.toLowerCase()) && t.toLowerCase().includes("current")
            );

            if (currentEnvTag) {
                result[env] = { version: versionTags[0], deployTime: undefined, gitReleaseDate: null, isCurrent: true };
                continue; // if we find a "current" tag for this env, we can skip processing other tags for this env since "current" tags take priority
            }

            const envTag = tags.find((t) =>
                t.toLowerCase().includes(env.toLowerCase())
            );

            if (!envTag) continue;

            const deployTime = calculateDeployTimeFromTag(envTag);

            for (const version of versionTags) {
                const existing = result[env];
                if (!existing) {
                    result[env] = { version, deployTime, gitReleaseDate: null };
                } else if (!existing.isCurrent) { // only consider updating if existing doesn't have "current" tag (since "current" tags take priority)
                    if (deployTime && existing.deployTime) {
                        if (deployTime > existing.deployTime) {
                            result[env] = { version, deployTime, gitReleaseDate: null };
                        }
                    } else if (deployTime && !existing.deployTime) {
                        // prefer deployTime-ed over non-deployTime-ed if existing doesn't have "current" in its tag
                        result[env] = { version, deployTime, gitReleaseDate: null };
                    }
                }
            }
            
        }
    }

    return result;
}