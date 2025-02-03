import { getEnvironmentValue, isRunningInLambda } from "../utils/envUtils";
import {getParamStore} from "../aws/ssm"

export const APPLICATION_NAME= "services-dashboard-ecs";

// MongoDB configuration
export const MONGO_PROTOCOL = getEnvironmentValue("MONGO_PROTOCOL", "mongodb");
export const MONGO_USER     = getEnvironmentValue("MONGO_USER");
export const MONGO_PASSWORD_PARAMSTORE_NAME=getEnvironmentValue("MONGO_PASSWORD_PARAMSTORE_NAME");
export const MONGO_PASSWORD   = isRunningInLambda() ?
    getParamStore(MONGO_PASSWORD_PARAMSTORE_NAME):
    getEnvironmentValue("MONGO_PASSWORD");
export const MONGO_AUTH       = MONGO_USER ? `${MONGO_USER}:${MONGO_PASSWORD}@` : "";
export const MONGO_AUTH_CLEAN = MONGO_USER ? `${MONGO_USER}:xxxx@` : "";
export const MONGO_HOST_AND_PORT = getEnvironmentValue("MONGO_HOST_AND_PORT");
export const MONGO_URI       = `${MONGO_PROTOCOL}://${MONGO_AUTH}${MONGO_HOST_AND_PORT}`;
export const MONGO_URI_CLEAN = `${MONGO_PROTOCOL}://${MONGO_AUTH_CLEAN}${MONGO_HOST_AND_PORT}`;
export const MONGO_DB_NAME = getEnvironmentValue("MONGO_DB_NAME");
export const MONGO_COLLECTION_PROJECTS = getEnvironmentValue("MONGO_COLLECTION_PROJECTS","projects");

// AWS configuration
export const AWS_PROFILE = getEnvironmentValue("AWS_PROFILE","dev");
export const REGION      = getEnvironmentValue("AWS_REGION","eu-west-2");
export const ENVIRONMENT = getEnvironmentValue("ENV","cidev");