- A Kubernetes cluster contains some number of nodes.
  - Each node is a virtual machine that will run some containers for us.
  - Since we are running Kubernetes on our own computer, we only have 1 node.

- A config file will contain some instruction like: please run 2 copies of Posts, and allows them to be accessible from network.

- `kubectl` is how we interact with the cluster.

- Kubernetes master will try to look into your Docker daemon in your local machine to find the image. If not found, it will download from Dockerhub.
- Each container that is created is hosted inside a `Pod`. A pod is the smallest unit of work in the Kubernetes world, but a pod can technically contain multiple containers. However, that's considered a bad practice, each pod should only host 1 container, so from now on we refer to pod and container interchangeably as they have a 1-1 relationship.

- In order to manage the pods, Kubernetes also creates a `Deployment`. If a pod crashes, the Deployment makes sure that pod is replaced.
- Kubernetes creates a `Service` to allow the copies of Posts to be accessible via network. A Service gives us access to running pods inside our cluster.


## Config Files
- Commit to Git
- Do not create Objects (Pods/Deployments/Services) without a config file. Config file is the source of truth.
- To apply a config file, run `kubectl apply ${file}.yaml`
- To inspect the state
  - To see the pods, `kubectl get pods`

- `apiVersion`: tell K8s about the pool of objects we can create. `v1` means the default set of objects, but there are other versions with custom objects.
- `kind: Pod`: type of object we want to create.
- `metadata`: config options for the object. Most common option is `name`.
- `spec`: control how the pod should behave. The only required field is `containers` and it's an array, that's why we have the little `-` before `name`, that signify this is the first container in the array.
```
spec:
  containers:
    - name: posts
      image: abunvi97/posts:0.0.1
```
  - `name`: not very important, unlike the metadata `name`. This helps us with debugging.
  - `image`: the tag. If we don't provide an explicit version, Docker will default to `:latest`, and Kubernetes default behaviour when it sees `:latest` (or no explicit version which implies `:latest`) is it will reach out to Docker hub (beccause it thinks it doesn't have the latest version locally). In our case, this will fail, because we never publish this image to Docker hub.


## Common kubectl commands
- `kubectl apply -f ${configFile}`
- `kubectl apply -f .`: Apply all files in the current directory
- `docker ps` <=> `kubectl get pods`
- `docker exec -it ${containerID} ${cmd}` <=> `kubectl exec -it ${podName} -- ${cmd}`
  - If you have multiple containers inside a pod, this command would ask you which container you want to run this cmd in. Not going to be the case for us as we only run 1 container per pod.
- `docker logs ${containerID}` <=> `kubectl logs ${podName}`
- `kubectl delete pod ${podName}`: delete this pod
- `kubectl describe pod ${podName}`: describe this pod

## Deployments
- We rarely create the Pod directly in the config file, we do that through the deployment.
- Maintain the desired number of running pods
- We might want to upgrade to a new version of the Posts service
- The deployment will create new pods with new versions, and gradually sunset the old pods.
- `kubectl get deployments`: get all deployments.
- `kubectl describe deployment ${deploymentName}`
- `kubectl delete deployment ${deploymentName}`: this will also delete all associated pods.

## Updating Deployments
- Method 1:
  - Change source code
  - Rebuild the Docker image with a new version
  - In the deployment config file, update the version of the image
  - Run `kubectl apply -f ${deplConfigFile}`

- Problem with method 1: anytime we want to deploy new version, we have to manually change the depl config file. The less we have to update the image version, the less error prone the process will be. It would be great if K8S can always use the latest version.

- Method 2:
  - The deployment must use the `latest` tag of the image (or just remove the version). However just by updating the tag to latest and `kubectl apply` does not really restart the pods using the latest version. We need to do the following steps
  - Make source code update
  - Build the image
  - Push the image to dockerhub
  - Tell the deployment to use the latest version with `kubectl rollout restart deployment ${deploymentName}`
  - From now on, anytime we want to get the newer version of the image to deploy, we no longer need to manually update the image tag in the yaml file, just update code + build image + push to dockerhub (with `latest` tag) and then `kubectl rollout restart deployment` to fetch the latest image.

## Networking with Services
- Service provide networking between pods, or from outside the cluster.
  - Cluster IP: Sets up an easy-to-remember URL to access a pod. Only exposed to pods in the cluster.
  - Node Port: makes a pod accessible from outside the cluster. Usually only used for dev purposes.
  - Load Balancer: similar to Node Port, makes a pod accesible from outside the cluster, but this is the right way to expose a pod to outside world
  - External Name: redirects an in-cluster request to a CNAME url. Don't worry much about this.

### Node Port
- Target port: for the container/pod itself
- Port: assigned to the Node Port Service itself. 
- Node Port: randomly assigned port that we can use to access this service from outside the cluster. In the form of 3xxxx. You can see this port when doing `kubectl get services` or `kubectl describe service ${serviceName}`
- Remember this type of service is mostly for dev purpose

## Cluster IP
- Allow communications between pods in the cluster.
- Pods can't communicate directly with each other (technically they can) because you can't predict ahead of time what IP address each pod will be assigned. Also as pods are destroyed/recreated, they get assigned totally different IPs, so the other pods cannot know how to reconnect to the new pods.
- It's obvious we need another layer of abstraction on top of the pods, and that's a Cluster IP service.
- To reach out to pods within a cluster IP, we just need to make the request to `http://${serviceName}:${servicePort}/...`

## Load Balancer Services
- First, we are going to serve our React App from a React App Dev Server. This will be running inside a Docker container
inside a Pod in our cluster (of one node) as well.
- This Dev Server is only responsible for taking our React Code and generate the HTML, JS + CSS out of it and return it
to browser on initial requests.
- Once the React app is up and running in the browser, it will make API requests DIRECTLY to our microservices, instead
of through the dev server. The React App Dev server will not interact with our query/comments/posts services in any way.
- How do we allow our React App to communicate with our microservices though?
  - Option 1 (bad): Have a NodePort service for each of our microservice. The issue with this option is NodePort is assigned
  a random port (we can choose it, but whatever), the point is when the NodePort service is updated, it might be assigned a
  differet port, then we have to go into our React App and update the code to reach the new port instead.
  - Option 2 (good): Use a Load Balancer Service. A single point of entry to our entire cluster. The LB service will route
  the request to the appropriate ClusterIP service.

- Load Balancer Service vs Ingress (or Ingress Controller)
  - Load Balancer Service: tells K8s to reach out to its provider and provision a load balance. Gets traffic into a single pod.
    - Our K8s cluster will eventually run in a cloud provider i.e AWS, GC, Azure
    - When we want to expose some pod in our cluster to the outside world, we write a Config File for a LoadBalancer Service.
    - This file instructs our K8s cluster to reach out to the cloud provider and create a Load Balancer.
    - This Load Balancer exists outside of our K8s cluster, it belongs to the cloud provider.
    - This load balancer will take outside traffic and direct it into some pod insdie our cluster.
    - This by itself, is not what we need. We want something smart that is able to route traffic to different pods depending on
    the URL paths for example. That's where Ingress comes into play.
  - Ingress: A pod with a set of routing rules to distribute traffic to other services. It works along side the Load Balancer.
    - Outside requests still come in to the cloud provider's Load Balancer.
    - The load balancer then forwards the request to the Ingress Controller, and this controller will have a set of routing rules inside it.
    - Ingress Controller decides which ClusterIP service it will send that request to. Ingress Controller, contrary to load balancer,
    lives inside our K8s cluster.

### ingress-nginx
- An open-source project that will create a Load Balancer Service + an Ingress Controller
- However we still have to write config file containing the router rules to teach this Ingress Controller how to route traffic to our services,
- The `annotations` section is very important so the Ingress controller created by `ingress-nginx` can understand we are trying to feed it some routing rules. The controller does this by scanning the objects created in our cluster and find ones with the annotations it's expecting.
- A single K8s cluster can host many applications with many different domains.
  - Hence, ingress-nginx is set up assuming you might be hosting different apps at different domains through the same ingress controller. That's what the `host` property is about: to tell the controller which domain we are targeting
  - In a develoment environment, we need to trick our computer to map `posts.com` to `localhost` => we change the `/etc/hosts` to add
```
127.0.0.1 posts.com
```

- Deploy the React App Pod
  - React App needs to make requests to `posts.com`.

- Defining the other route paths:
  - Remember that we have `POST /posts` that should go to the Posts Service to create the post, and then we have `GET /posts` that should go to the Query service to query posts + comments?
  - Unfortunately, this is not possible with `ingress-nginx` because it's unable to route requests
  differently based on the HTTP method i.e GET/POST, given the route prefix is the same `/posts`.
  - Therefore, we have to change our Create endpoint to `posts/create`. See this final [image](readme-images/ingress-paths.png)

  - `ingress-nginx` will map the route paths from top to bottom, so any wild card paths like `/?(.*)` needs to be put at the bottom so only when no other paths match then this one is used.


### Skaffold
- As we may have noticed by now, the process of update code - rebuild image - push to Dockerhub - Run `kubectl rollout restart deployment...` is a super tedious process to test your changes in local development.
- We will instead use a tool called Skaffold, which makes it super easy to update code in a running pod. It also makes it easy to create/delete all objects tied to a project at once.

- Skaffold runs outside of our cluster.
```yml
deploy:
  kubectl:
    manifests:
      - ./infra/k8s/*
```
  - From here, Skaffold will start watching for these files under `infra/k8s` directories, and whenever a file changes, it will re-apply the file onto our K8s cluster.
  - It will also apply all the config files when we first start skaffold up, and delete all objects associated with these files when we stop skaffold.
  - By default, whenever Skaffold makes a change to an image/rebuild an image, it will push it up to Dockerhub. That's not actually required when we use Skaffold, so we disable it with
```yml
build:
  local:
    push: false
```
  - Note that with Skaffold, the ability to watch for file changes and syncing them into the running Pod is only useful because we have hot reloading:
    - For `client`, the hot reloading is built-into create-react-app which watch for file changes, and recompile the project and reload the browser for us.
    - For other microservices, we run it with `nodemon`, which has the same ability to watch for file changes, and when it see the changed file synced by Skaffold, it will restart the service.

