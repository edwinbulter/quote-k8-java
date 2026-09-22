# Quote Azure Frontend

A modern, responsive quote management web application built with React and TypeScript, deployed on Azure Storage Static Website. This frontend connects to the Azure Functions backend to provide a seamless quote browsing and management experience.

## Table of Contents

- [🚀 Features](#-features)
- [🛠️ Technology Stack](#️-technology-stack)
- [📦 Project Structure](#-project-structure)
- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)
- [🏗️ Build & Deployment](#️-build--deployment)
  - [Local Build](#local-build)
  - [Azure Deployment](#azure-deployment)
    - [Option 1: GitHub Actions (Recommended)](#option-1-github-actions-recommended)
    - [Option 2: Manual Deployment](#option-2-manual-deployment)
  - [Infrastructure Deployment](#infrastructure-deployment)
- [🔧 Configuration](#-configuration)
  - [API Configuration](#api-configuration)
  - [Build Configuration](#build-configuration)
- [🌐 Live Demo](#-live-demo)
- [🎯 Key Features Explained](#-key-features-explained)
  - [Quote Management](#quote-management)
  - [Authentication](#authentication)
  - [Performance](#performance)
- [🔍 Browser Support](#-browser-support)
- [🔗 Related Projects](#-related-projects)

## 🚀 Features

- **Browse Quotes**: View a collection of inspiring quotes with pagination
- **Like/Unlike**: Save your favorite quotes with a single click
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-time Updates**: Instant feedback when liking/unliking quotes
- **Authentication Integration**: Secure user authentication with JWT tokens
- **Modern UI**: Clean, intuitive interface built with TailwindCSS

## 🛠️ Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: TailwindCSS for utility-first CSS
- **State Management**: React Query for server state management
- **HTTP Client**: Axios for API communication
- **Authentication**: JWT token-based authentication
- **Deployment**: Azure Storage Static Website
- **CI/CD**: GitHub Actions for automated deployment

## 📦 Project Structure

```
quote-azure-frontend/
├── public/                 # Static assets
│   ├── Q-32x32.png        # App icon
│   └── favicon.ico        # Favicon
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── QuoteCard.tsx  # Quote display component
│   │   ├── QuoteList.tsx  # List of quotes
│   │   ├── LikeButton.tsx # Like/unlike functionality
│   │   └── Layout.tsx     # App layout wrapper
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts     # Authentication logic
│   │   ├── useQuotes.ts   # Quote data fetching
│   │   └── useLikes.ts    # Like/unlike operations
│   ├── services/          # API services
│   │   ├── api.ts         # API client configuration
│   │   ├── authService.ts # Authentication service
│   │   └── quoteService.ts # Quote-related API calls
│   ├── types/             # TypeScript type definitions
│   │   ├── Quote.ts       # Quote data types
│   │   ├── User.ts        # User data types
│   │   └── Auth.ts        # Authentication types
│   ├── utils/             # Utility functions
│   │   ├── constants.ts   # App constants
│   │   ├── helpers.ts     # Helper functions
│   │   └── storage.ts     # Local storage utilities
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
├── infrastructure/        # Azure infrastructure (Terraform)
│   ├── main.tf           # Azure Storage configuration
│   ├── variables.tf      # Terraform variables
│   ├── outputs.tf        # Terraform outputs
│   └── backend.tf        # Remote state configuration
├── .github/workflows/     # GitHub Actions workflows
│   └── deploy-azure-frontend.yml # CI/CD pipeline
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
├── tailwind.config.js    # TailwindCSS configuration
└── README.md            # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Azure CLI** (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd quote-lambda-tf/quote-azure-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

### Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_API_BASE_URL=https://quote-api-gateway.azure-api.net/quote
VITE_APP_TITLE=Quote Azure
VITE_APP_DESCRIPTION=Browse and manage your favorite quotes
```

## 🏗️ Build & Deployment

### Local Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Azure Deployment

#### Option 1: GitHub Actions (Recommended)

1. **Configure GitHub Secrets**:
   - `AZURE_STORAGE_ACCOUNT`: Your Azure Storage account name
   - `AZURE_SAS_TOKEN`: Storage account SAS token with write permissions

2. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Deploy to Azure"
   git push origin main
   ```

3. **The GitHub Action [deploy-azure-frontend.yml](../.github/workflows/deploy-azure-frontend.yml) will automatically**:
   - Build the application
   - Upload to Azure Storage Static Website
   - Deploy to `https://quotefrontend.z6.web.core.windows.net/`

#### Option 2: Manual Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Azure Storage**:
   ```bash
   az storage blob upload-batch \
     --destination '$web' \
     --source ./dist \
     --account-name <your-storage-account>
   ```

### Infrastructure Deployment

The Azure infrastructure is managed with Terraform. For detailed instructions, see the [infrastructure README](infrastructure/README.md).

Quick overview:
```bash
cd infrastructure

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Apply the changes
terraform apply
```

## 🔧 Configuration

### API Configuration

The application connects to the Azure Functions backend through API Management. Key configuration:

- **Base URL**: Set via `VITE_API_BASE_URL` environment variable
- **Authentication**: JWT tokens stored in localStorage
- **CORS**: Configured in API Management for secure cross-origin requests

### Build Configuration

- **Vite**: Fast development server and optimized builds
- **TypeScript**: Type safety and better developer experience
- **TailwindCSS**: Utility-first CSS framework
- **React Query**: Efficient server state management

## 🌐 Live Demo

- **URL**: https://quotefrontend.z6.web.core.windows.net/
- **Backend API**: https://quote-api-gateway.azure-api.net/quote
- **Status**: ✅ Production ready

## 🎯 Key Features Explained

### Quote Management
- Browse through paginated list of quotes
- View quote details including author and content
- Like/unlike quotes with instant visual feedback
- Persistent like state across sessions

### Authentication
- JWT-based authentication with Azure Functions backend
- Automatic token refresh
- Secure token storage
- Protected API endpoints

### Performance
- Optimized bundle size with Vite
- Lazy loading of components
- Efficient caching strategies
- Responsive image handling

## 🔍 Browser Support

- **Chrome** >= 90
- **Firefox** >= 88
- **Safari** >= 14
- **Edge** >= 90

## 🔗 Related Projects

- **Backend**: [quote-azure-backend](../quote-azure-backend/) - Azure Functions API
- **Infrastructure**: [Terraform Configuration](./infrastructure/) - Azure resources
- **AWS Version**: [quote-lambda-tf-frontend](../quote-lambda-tf-frontend/) - AWS deployment
