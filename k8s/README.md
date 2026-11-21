# Deploying ScaleTok to Azure Kubernetes Service (AKS)

| File | What it creates |
| --- | --- |
| `namespace.yaml` | The `scaletok` namespace that holds everything |
| `backend.yaml` | Backend Deployment (2 pods, `/health` probes) and its Service |
| `frontend.yaml` | Frontend Deployment (2 pods, nginx) and its Service |
| `ingress.yaml` | One public address: `/api` and `/health` go to the backend, everything else to the frontend |
| `hpa.yaml` | Autoscaling: backend 2–6 pods, frontend 2–4 pods, at 70% CPU |

The backend's secrets (MongoDB, JWT, Azure Storage, Azure AI Language) are stored in a
Kubernetes Secret created from `Backend/.env`, so they never go into git or the images.

Run every command from the project root (`~/Documents/Scalable`).

## 1. Build and push both images

```bash
az acr login --name scaletokacr123

docker build --platform linux/amd64 \
  -t scaletokacr123.azurecr.io/scaletok-backend:v1 ./Backend
docker push scaletokacr123.azurecr.io/scaletok-backend:v1

# Empty VITE_API_URL: the site calls the API on its own address (through the Ingress).
docker build --platform linux/amd64 --build-arg VITE_API_URL= \
  -t scaletokacr123.azurecr.io/scaletok-frontend:v1 ./Frontend/Frontend
docker push scaletokacr123.azurecr.io/scaletok-frontend:v1
```

## 2. Create the cluster

```bash
az aks create \
  --resource-group scaletok-rg \
  --name scaletok-aks \
  --tier free \
  --node-count 1 \
  --node-vm-size Standard_B2s \
  --attach-acr scaletokacr123 \
  --enable-app-routing \
  --generate-ssh-keys

az aks get-credentials --resource-group scaletok-rg --name scaletok-aks
kubectl get nodes
```

If `Standard_B2s` is not available in your region, try `Standard_B2als_v2` or `Standard_D2s_v3`.

## 3. Deploy

```bash
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic scaletok-backend-env \
  --from-env-file=Backend/.env --namespace scaletok
kubectl apply -f k8s/
```

## 4. Get the public address

```bash
kubectl get ingress -n scaletok      # wait until ADDRESS shows an IP
kubectl get pods -n scaletok         # all pods should be Running and 1/1 READY
```

Open `http://<ADDRESS>` in a browser.

## 5. Allow the new address

- **MongoDB Atlas → Network Access:** add the cluster's outbound IP. Find it with
  `kubectl run ip-check --rm -it --restart=Never --image=curlimages/curl -- curl -s ifconfig.me`
- **Storage account → Resource sharing (CORS) → Blob service:** add `http://<ADDRESS>`
  to the allowed origins, otherwise uploads fail.

## Updating after a code change

Build and push with a new tag (`v2`, `v3`, …), then:

```bash
kubectl set image deployment/backend backend=scaletokacr123.azurecr.io/scaletok-backend:v2 -n scaletok
kubectl set image deployment/frontend frontend=scaletokacr123.azurecr.io/scaletok-frontend:v2 -n scaletok
```

After changing `Backend/.env`, recreate the Secret and restart the backend:

```bash
kubectl delete secret scaletok-backend-env -n scaletok
kubectl create secret generic scaletok-backend-env --from-env-file=Backend/.env -n scaletok
kubectl rollout restart deployment/backend -n scaletok
```

## Useful commands

```bash
kubectl logs -l app=backend -n scaletok --tail 50   # backend logs
kubectl get hpa -n scaletok                         # autoscaler status
az aks stop  --resource-group scaletok-rg --name scaletok-aks   # pause to save credit
az aks start --resource-group scaletok-rg --name scaletok-aks
```
