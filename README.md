# quote-k8-java

This project is a cloud-agnostic Kubernetes implementation of a quote application, originally based on the Azure-specific version at https://github.com/edwinbulter/quote-azure-k8.

## Project Intentions

This project was created with the following goals:

- **Cloud Provider Independence**: Create a less cloud-provider-dependent version of the original Azure-specific quote-k8 project, reducing reliance on Azure-specific services and enabling deployment to other cloud providers.

- **Local Development with Kind**: Learn how to run and test the Kubernetes project locally using a kind (Kubernetes in Docker) cluster for development and testing purposes.

- **Scaleway Deployment**: Learn how to port and run the Kubernetes project to [Scaleway](http://www.scaleway.com) while keeping infrastructure costs as low as possible.

- **Java/Quarkus Migration**: Port the quote backend functionality from C# (as implemented in the original quote-azure-k8 repository) to Java using the Quarkus framework, leveraging Quarkus's performance optimizations for improved Java application performance.

## Project Structure

- `k8-quote-api/` - Quarkus-based Java backend API
- `k8-quote-frontend/` - Frontend application
- `k8/` - Kubernetes manifests and configuration
- `scripts/` - Deployment and setup scripts
- `doc/` - Documentation

## Getting Started

See the documentation in the `doc/` directory for detailed setup and deployment instructions.
