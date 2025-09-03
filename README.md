# services-dashboard-ecs

This service is the ECS component of the services dashboard.
_(Refer to the main documentation in [services-dashboard-api](https://github.com/companieshouse/services-dashboard-api/) for an overview.)_

It is primarily designed to integrate ECS information into Mongo.
An initial version of this lambda directly scanned the ECS clusters of the AWS account ($env = cidev/staging/live) where this lambda was deployed. It then updated the relevant ECS.$env field in Mongo. However, given the impossibility of accessing the same Mongo DB from different AWS accounts, this service was reimplemented once Platform completed tagging the images in ECR for each service deployed in ECS (cidev/staging/live). An example of the tags is shown below.
Staging and live tags also have a `date_time` format that is used to determine the latest version deployed.

### Example of ECS information added to a project:
![ECS info](https://github.com/companieshouse/services-dashboard-ecs/blob/89054cb/images/mongo.ecs-info.png?raw=true)

### Example of ECR image tagging:
![ECR image tags](https://github.com/companieshouse/services-dashboard-ecs/blob/368420d/images/ECR.image.tagging.png?raw=true)

