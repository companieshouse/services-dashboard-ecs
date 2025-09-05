import { getEnvironmentValue } from "../utils/envUtils.js";

export const APPLICATION_NAME= "services-dashboard-ecs";

// MongoDB configuration
export const MONGO_PROTOCOL = getEnvironmentValue("MONGO_PROTOCOL", "mongodb");
export const MONGO_USER     = getEnvironmentValue("MONGO_USER");
export const MONGO_PASSWORD_PARAMSTORE_NAME = getEnvironmentValue("MONGO_PASSWORD_PARAMSTORE_NAME");
export const MONGO_HOST_AND_PORT = getEnvironmentValue("MONGO_HOST_AND_PORT");
export const MONGO_DB_NAME = getEnvironmentValue("MONGO_DB_NAME");
export const MONGO_COLLECTION_PROJECTS = getEnvironmentValue("MONGO_COLLECTION_PROJECTS","projects");
export const MONGO_COLLECTION_CONFIG = getEnvironmentValue("MONGO_COLLECTION_CONFIG","config");
export const MONGO_CONFIG_SINGLETON = getEnvironmentValue("MONGO_CONFIG_SINGLETON","singletonConfig");


// GITHUB configuration
export const GH_API  = "api.github.com";
export const GH_ORG  = "companieshouse";
export const GH_ENDPOINT_REPOS = `/repos/${GH_ORG}`;
export const GH_HEADER_ACCEPT = "application/vnd.github.v3+json"
export const GH_TOKEN_PARAMSTORE_NAME = getEnvironmentValue("GH_TOKEN_PARAMSTORE_NAME");
export const GH_TIMEOUT_MS = 5000;

// AWS configuration
export const AWS_PROFILE    = getEnvironmentValue("AWS_PROFILE","shs");
export const REGION         = getEnvironmentValue("AWS_REGION","eu-west-2");
export const ECR_REGISTRYID = getEnvironmentValue("ECR_REGISTRYID");
