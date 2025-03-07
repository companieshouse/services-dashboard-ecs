import * as https from "https";

import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils.js";
import * as config from "../config/index.js";
import {logger, logErr} from "../utils/logger.js";
import {getParamStore} from "../aws/ssm.js"

let ghToken: string = "";

async function getGitToken() {
   try {
      if (!ghToken) {
         logger.info("Setting GitHub Token");
         ghToken = isRunningInLambda() ?
            await getParamStore(config.GH_TOKEN_PARAMSTORE_NAME):
            getEnvironmentValue("GH_TOKEN");
      }
   }
   catch(error) {
      logErr(error, "Error setting GitHub Token:");
   }
}

export async function getReleaseDate (
   repo: string,
   tag: string,
   timeoutMs = config.GH_TIMEOUT_MS ): Promise<string | null> {

   logger.info(`Retrieving GitHub Release info: repo:${repo} Release tag:${tag}`);

   const url = `${config.GH_REPO_BASE}/${repo}/releases/tags/${tag}`;

   await getGitToken();

   const options = {
       headers: {
           "User-Agent": config.APPLICATION_NAME,
           "Accept":     config.GH_HEADER_ACCEPT,
           "Authorization": `Bearer ${ghToken}`
       }
   };

   return new Promise((resolve, reject) => {
       const req = https.get(url, options, (res) => {
           let data = "";

           res.on("data", (chunk) => {
               data += chunk;
           });

           res.on("end", () => {
               try {
                   const json = JSON.parse(data);
                   resolve(json.published_at || null);
               } catch (error) {
                   reject(error);
               }
           });
       });

       req.on("error", (err) => {
           reject(err);
       });

       // Timeout handling
       const timeout = setTimeout(() => {
           req.destroy(); // Abort the request
           reject(new Error(`Request timed out after ${timeoutMs}ms`));
       }, timeoutMs);

       req.on("response", () => {
           clearTimeout(timeout); // Cancel timeout if response is received
       });

       req.end();
   });
}