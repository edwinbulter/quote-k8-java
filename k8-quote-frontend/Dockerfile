# Stage 1: Build the React application (local build)
# Build locally with: npm run build
# Then copy dist directory

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY dist /usr/share/nginx/html
# Copy nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
