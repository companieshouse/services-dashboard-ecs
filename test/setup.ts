export default () => {
  process.env.MONGO_PROTOCOL="mongodb+srv"
  process.env.MONGO_USER="rand_dev"
  process.env.MONGO_PASSWORD_PARAMSTORE_NAME="/services-dashboard-ecs/mongo_password"
  process.env.MONGO_HOST_AND_PORT="ci-dev-pl-0.ueium.mongodb.net"
  process.env.MONGO_DB_NAME="services_dashboard"
  process.env.GH_TOKEN_PARAMSTORE_NAME="/services-dashboard-ecs/gh_token"
  process.env.ECR_REGISTRYID="416670754337"
};
