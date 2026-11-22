# Deploying ScaleTok to Azure Kubernetes Service (AKS)

| File | What it creates |
| --- | --- |
| `namespace.yaml` | The `scaletok` namespace that holds everything |
| `backend.yaml` | Backend Deployment (2 pods, `/health` probes) and its Service |
| `frontend.yaml` | Frontend Deployment (2 pods, nginx) and its Service |
| `ingress.yaml` | One public address: `/api` and `/health` go to the backend, everything else to the frontend |
| `hpa.yaml` | Autoscaling: backend 2–6 pods, frontend 2–4 pods, at 70% CPU |
| `ingress-controller.yaml` | Gives the Ingress public IP the DNS name `scaletok.polandcentral.cloudapp.azure.com` |
| `cluster-issuer.yaml` | Let's Encrypt issuer for cert-manager (free HTTPS certificate, auto-renewed) |
| `local/ingress.yaml` | Ingress for local testing on Docker Desktop Kubernetes |

The backend's secrets (MongoDB, JWT, Azure Storage, and the Azure AI keys: Language, Content Safety, Translator, Vision, Speech) are stored in a
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
  --location polandcentral \
  --tier free \
  --node-count 1 \
  --node-vm-size Standard_B2als_v2 \
  --attach-acr scaletokacr123 \
  --enable-app-routing \
  --ssh-access disabled

az aks get-credentials --resource-group scaletok-rg --name scaletok-aks
kubectl get nodes
```

Azure for Students only allows some regions and VM sizes for AKS. France Central only offered
v7 sizes with 0 quota, so the cluster runs in Poland Central on `Standard_B2als_v2`
(the registry stays in France Central). Add `--subscription "Azure for Students"` to `az`
commands if your default subscription is a different one.

## 3. Deploy

```bash
# cert-manager issues the HTTPS certificate
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
kubectl wait -n cert-manager --for=condition=Available deployment --all --timeout=240s

kubectl apply -f k8s/namespace.yaml
kubectl create secret generic scaletok-backend-env \
  --from-env-file=Backend/.env --namespace scaletok
kubectl apply -f k8s/
kubectl get certificate -n scaletok   # READY becomes True within a minute or two
```

The site is served at **https://scaletok.polandcentral.cloudapp.azure.com** (HTTP redirects to HTTPS).

## 4. Get the public address

```bash
kubectl get ingress -n scaletok      # wait until ADDRESS shows an IP
kubectl get pods -n scaletok         # all pods should be Running and 1/1 READY
```

Open `https://scaletok.polandcentral.cloudapp.azure.com` in a browser.

## 5. Allow the new address

- **MongoDB Atlas → Network Access:** add the cluster's outbound IP. Find it with
  `kubectl run ip-check --rm -it --restart=Never --image=curlimages/curl -- curl -s ifconfig.me`
- **Storage account → Resource sharing (CORS) → Blob service:** add
  `https://scaletok.polandcentral.cloudapp.azure.com` to the allowed origins, otherwise uploads fail.

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
