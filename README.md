# services-dashboard-ecs

This is the working version, used for several months until Platform completed ECR tagging. The approach in this case was to examine the ECS clusters of an associated AWS account (cidev/staging or live), acquire data from all running ECS ​​versions, and update the `"ecs."[$env]` entries in Mongo. However, since it was not possible to connect to the same Mongo from different AWS accounts, this approach failed to achieve its objectives, and therefore only one ECS column (cidev) of the three requested could be populated:

![ECS info](https://github.com/companieshouse/services-dashboard-ecs/blob/4a94de2/images/ECS.info.from.Clusters.png?raw=true)



## legacy README

This service is the ECS component of the services dashboard.
_(Refer to the main documentation in [services-dashboard-api](https://github.com/companieshouse/services-dashboard-api/) for an overview.)_

It is primarily designed to integrate ECS information (sourced from the AWS account where this lambda function is deployed (cidev / staging / live)) into Mongo.

### Example of ECS information added to a project:
![ECS info](https://github.com/companieshouse/services-dashboard-ecs/blob/89054cb/images/mongo.ecs-info.png?raw=true)
