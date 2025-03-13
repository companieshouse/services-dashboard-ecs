# services-dashboard-ecs

This service is the ECS component of the services dashboard.
_(Refer to the main documentation in [services-dashboard-api](https://github.com/companieshouse/services-dashboard-api/) for an overview.)_

It is primarily designed to integrate ECS information (sourced from the AWS account where this lambda function is deployed (cidev / staging / live)) into Mongo.

### Example of ECS information added to a project:
![ECS info](https://github.com/companieshouse/services-dashboard-ecs/blob/89054cb/images/mongo.ecs-info.png?raw=true)
