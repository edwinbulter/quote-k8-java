
Describe in a markdown document how to create a base K8 project that can be deployed on any Cloud Provider that supports K8. The requirements are:
- use the already locally running Kind K8 cluster for running the application (context=kind-multi-node-cluster)
- use the new namespace quote-k8-java for the application
- create the API in Java Quarkus
- Database: MongoDB with MongoDB Operator
- Run local with Quarkus JVM in Kind K8
- Run in the cloud with Quarkus Native (GraalVM)
- As a start, make the endpoint GET {{baseUrl}}/api/quotes/random work by migrating the exact functionality from doc/quote-azure-k8-backend to the new project. This endpoint fetches data from ZenQuotes when the database is empty and stores it in the database, or returns a random quote from the database.


Create a markdown file describing the implementation, deployment and testing (on the local Kind K8 cluster) for this endpoint: 
### 32. Change password
POST {{baseUrl}}/api/auth/change-password
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "currentPassword": "Hello-user-c",
  "newPassword": "NewUser123!",
  "confirmNewPassword": "NewUser123!"
}
by migrating the C# code in quote-azure-k8-backend to Java

Do everything as described in change-password-implementation.md
