import * as https from "https";

import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils.js";
import * as config from "../config/index.js";
import {logger, logErr} from "../utils/logger.js";
import {getParamStore} from "../aws/ssm.js"

let ghToken: string = "";

let HttpReqOptionsBase: https.RequestOptions = {
    hostname: config.GH_API,
    port: 443,
    method: "GET",
    headers: {
        "User-Agent": config.APPLICATION_NAME,
        "Accept":     config.GH_HEADER_ACCEPT
    } as Record<string, string>,
    timeout: config.GH_TIMEOUT_MS,
};

async function getGitToken() {
    try {
        if (!ghToken) {
            logger.info("Setting GitHub Token");
            ghToken = isRunningInLambda() ?
                await getParamStore(config.GH_TOKEN_PARAMSTORE_NAME):
                getEnvironmentValue("GH_TOKEN");
            logger.info("GitHub Token set successfully.");

        (HttpReqOptionsBase.headers as Record<string, string>)["Authorization"] = `Bearer ${ghToken}`;
        }
    }
    catch(error) {
        logErr(error, "Error setting GitHub Token:");
    }
}

export async function getReleaseDate (
    repo: string,
    tag: string,
    timeoutMs = config.GH_TIMEOUT_MS ): Promise<Date | null> {

    logger.info(`Retrieving GitHub Release info: repo:${repo} Release tag:${tag}`);

    await getGitToken();

    const options = {
        ...HttpReqOptionsBase,
        path: `${config.GH_ENDPOINT_REPOS}/${repo}/releases/tags/${tag}`
    };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";

           res.on("data", (chunk) => {
               data += chunk;
           });

           res.on("end", () => {
               try {
                   const json = JSON.parse(data);
                   const date = json.published_at ? new Date(json.published_at) : null;
                   resolve(date);
               } catch (error) {
                   reject(error);
               }
           });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`Request timeout [after ${timeoutMs}ms]`));
        });

        req.on("error", (err) => {
           reject(err);
        });

       req.end();
   });
}
