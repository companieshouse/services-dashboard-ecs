
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Create an SSM client
const ssmClient = new SSMClient({});

export async function getParamStore(paramName:string): Promise<string> {
   const command = new GetParameterCommand({
       Name: paramName,
       WithDecryption: true // Decrypt as it's a SecureString
   });

   try {
       const data = await ssmClient.send(command);
       return data.Parameter?.Value || '';
   } catch (error) {
       console.error(`Error retrieving param:[${paramName}] from Parameter Store:`, error);
       throw error;
   }
}