## Debugging
logging opvragen:
```bash
kubectl logs quote-api-jvm-6668d99b4f-ffllf -n quote-k8-java --tail=50
```

Rebuilden:
```bash
mvn clean package -DskipTests
```

Build container-image:
```bash
podman build -f Containerfile.jvm -t quote-api:latest-jvm .
```

Avoid Mac podman/kind cache problem:
```bash
podman save -o quote-api.tar localhost/quote-api:latest-jvm
kind load image-archive quote-api.tar --name single-node
rm quote-api.tar
k rollout restart deployment/quote-api-jvm
```

Check status:
```bash
kubectl get pods -n quote-k8-java
```

Test with port forwarding:
```bash
kubectl port-forward svc/quote-api-service 8080:80 -n quote-k8-java
```

Test curl:
```bash
curl http://localhost:8080/quote
```

