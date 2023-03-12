## Request Minimisation Strategies
- Currently, we make a GET request to get the comments for each of the post we have.
=> inefficient.

=> Introduce a new Query Service
- Listen for post and comment created event and reorganise them into an efficient data structure that can serve a single request from brower to fetch all posts with their comments.

## Deploy
- Docker and Kubernetes.

### Docker
- Separate Docker container for each service.

### Kubernetes
- Tool for running a bunch of containers.
- Handle network requests between these containers.
- A kubernetes cluster:
  - A set of virtual machines (nodes)
  - A master (manage everything in the cluster)
  - Assign the containers into the nodes.
  - Kubernetes Service: the event bus can just talk to this one, and this one will figure out to randomly distribute the request to a specific instance of a service.

