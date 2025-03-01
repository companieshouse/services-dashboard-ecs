
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

import {logger} from "../utils/logger.js";

// Create an SSM client
const ssmClient = new SSMClient({});

export async function getParamStore(paramName:string): Promise<string> {
   const command = new GetParameterCommand({
       Name: paramName,
       WithDecryption: true // Decrypt as it's a SecureString
   });

   try {
       const data = await ssmClient.send(command);
       logger.info(`retrieving param:[${paramName}] from Parameter Store`);
       return data.Parameter?.Value || '';
   } catch (error: any) {
        logger.error(`Error retrieving param:[${paramName}] from Parameter Store: ${(error as Error).message}`);
        throw error;
   }
}