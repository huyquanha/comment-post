`docker run`: 
  - docker client sends this docker server.
  - Docker server checks the image cache.
  - If the requested image is not there, download from Docker Hub.

## Container

- Namespacing: isolating resources per process (resources are hard drive, network...)
- Control groups:
  - Limit amount of resources used per process (memory, CPU, HD I/O, network bandwidth)

- A container is a basically a running process and a segment of resources assigned to it.

- An image is like a file system snapshot. The image also contains a startup command.
  - The kernel isolate a subset of hard drive for this image.
  - The file snapshot is placed into that hard drive segment
  - The startup command is executed to create a new instance of the process.

- How Docker containers run on your computer?
  - Namspacing and control groups are features only available to Linux. So how can Docker be run on MacOS/Windows if it relies on these features?
    - When you install Docker for Windows/Mac, you actually install a Linux virtual machine.
    - Inside this virtual machine is where all containers are created as we have a Linux kernel inside this virtual machine.

## Docker Run in Details
- `docker run ${image}`
  - If the image is not available locally, download it from Docker Hub
  - `run` will also run the startup command defined in the `Dockerfile` of the image.
  - `docker run ${image} ${command}`: override the default startup command with ${command}.
    - To test this you can do `docker run busybox ls` or `docker run busybox echo hi there` to see the ls/echo command taking over whatever default command `busybox` is set up to start with.
    - We need to use `busybox` instead of `hello-world` because the filesystem snapshot included in `busybox` has the executables like `ls` and `echo` defined, while `hello-world` doesn't have them.

## List Running containers
- `docker ps`
  - Common use case: get the ID/name of the container.
- `docker ps -a`: show all containers that have ever been created on your machine.

## Container Lifecycle
- `docker run` = `docker create` + `docker start`.
  - `docker create ${image}`: Take the FS snapshot and put them in the dedicated hard drive section. This will print out the container ID.
  - `docker start -a ${containerID}`: run the startup command to create the running process. 
    - `-a` (short for "attach"), makes Docker watch for output from the container and print them out to your terminal. Without it, `docker start` will just print out the container ID again.

- After you run `docker run busybox echo hi there`, it's short-running process so the container stops/exits immediately after. However the container is still there, and we can re-trigger the side effect by starting it again with `docker start -a`. Note however, that when you start the container again, the default command cannot be replaced.

- To remove stopped containers: `docker system prune`. This will also remove:
  - All networks not used by any container
  - All dangling images
  - all build cache

## Retrieving Output logs
- `docker logs ${containerID}`: not restarting container, just get a log history.

## Stopping containers
- `docker stop/kill ${containerID}`
  - `stop` will send a `SIGTERM` signal to the running process inside the container. The process is allowed a bit of cleanup before shutting down. RECOMMENDED! However after 10s, if the process still fails to shutdown, Docker will issue a `kill` command to shutdown immediately.
  - `kill` will send `SIGKILL` to the running process. The process has to shutdown right now. 

## Executing commands inside containers
- The example is on redis. Normally you can run `redis-server` to start up the Redis server, then run `redis-cli` on the same machine and you will be connected to the server. How does this work with Docker?
  - `docker run redis`: run the redis server inside the Docker container.
  - `redis-cli`: this will fail, because the Redis server is only available inside the container, the CLI from your machine can't access it. To connect to the server, you need to somehow run `redis-cli` inside the container.
    - `docker exec -it ${containerID} ${command}`
      - `-it`: allows us to provide input to the container.


## The Purpose of `-it` flag
- Every process you create in a Linux environment has 3 communication channels attached to it: 
  - `stdin` (input) i.e stuff you type on the command in the terminal.
  - `stdout` and `stderr`: output from the process, redirected back to the terminal.

- `-it` is actually `-i` and `-t`
  - `-i`: when we execute this command in the container, we want to attach our terminal to the `stdin` channel of that new process, and information from the process out to our terminal => any stuff you type on your terminal get redirected to `stdin` of `redis-cli`
  - `-t`: makes the text show up in a nicely formatted manner.

## Getting a Command Prompt in a Container
- Get shell access to your running container without repeating `docker exec` again and again.
- `docker exec -it ${containerID} sh`
  - `sh` is a shell/command processor, similar to `bash` or `zsh`. The reason we use `sh` is because it's very popular and almost guaranteed to be installed in most Docker containers you work with (you can't invoke `sh` if it's not installed inside the container). 
  - `^ + D`/`exit` to get out of shell and back to your own terminal (`^ + C` will not work).

## Starting with a shell
- `docker run -it busybox sh`
  - This will start up a new container based on `busybox` image, but override the default startup command with `sh` and with the `-it` flag, we will attach our terminal to stdin/out of `sh`.
  - Downside: this will not run any other processes that maybe defined inside the image, so it's more common to start the container with the default startup command first, and then use `docker exec -it ... sh` to get shell access into it and run other commands as you please.

## Container isolation
- 2 running containers (even from same image) have totally separate filesystem.

## Creating Docker Images
- Docker Client provides `Dockerfile` to Docker Server
- Docker Server builds the image.
- Flow:
  - Specify a base image
  - Run some commands to install additional programs
  - Specify a command to run on container startup.

```
# Use an existing docker image as base
FROM alpine

# Download and install dependency
RUN apk add --update redis

# Startup command
CMD ["redis-server"]
```
  - Base image gives us a starting set of programs. What is `alpine`? 
    - `alpine` has an useful command: `apk add` which is Apache package manager to help us install other things, like redis.

- `docker build .`
  - `.` is the build context. The set of files and folders we want to wrap in the build.
  - For every instruction except the first one, there seems to be a temporary container created that gets cleaned up later.
    - For each subsequent command except the 1st, it look at the image created from the last step, and create a container from that image.
    - It then executes the command (e.g `apk add`) inside this new container as the primary running process, and it may add `redis` somewhere in the filesystem.
    - We then stop&remove that container, and take a file snapshot of that container to serve as the new image for the next step. This image will have `redis` on it.
    - With the last `CMD` instruction, this just adds the primary command to the image (even though a temporary container is still spinned up and cleaned up later). The final image will have `redis` and `redis-server` set as the primary running command.

- Any steps that are repeated when rebuilding an image is served from cache.

## Tagging an image
- `docker build -t ${imageTag} .`: build and create a tag for the image.
- The tag name convention is: `{yourDockerId}/${repo/projectName}:${version}`
  - For example your Dockerhub ID is `abunvi97` and you have an image name `pinger`. The image name actually serves as the repository name in Dockerhub, and then you have the versions inside that, something like `1.0.0` or `latest`.
    => your full tag name would be `abunvi97/pinger:1.0.0`
  - Why some images have simpler name i.e `busybox`, `hello-world` or `redis`? That's because they are community images: they have been open-sourced for popular use.
  - Technically, only the version is the tag, but we call this whole processing tagging the image anyway.

## Manual image generation with Docker commit
- You use image to create container, but you can also use a container to generate an image (remember the temporary container -> image -> clean up container above?)

```
docker run -it alpine sh

/# apk add --update redis

# -c to specify the startup command
# This will output an image ID.
docker commit -c 'CMD ["redis-server"]' ${aboveContainerID}
```

What is `alpine`?
  - A term in Docker world for an image as small and compact as possible

## An example Dockerfile for NodeJS web server

```
FROM node:alpine

COPy ./ ./
RUN npm install

CMD ["npm", "start"]
```

### The COPY command
- `COPY ${srcPath} ${destPath}`
  - `srcPath`: path to folder to copy from your own filesystem. This path is relative to the build context specified by `docker build`.
  - `destPath`: path to copy stuff to, inside your container.

## Container Port forwarding
- Forward requests from a port on localhost to a container port where the server is listening to.
  - This is just for incoming requests: by default, Docker container can reach out freely to the Internet.
- We setup port forwarding at the container run-time
  - `docker run -p ${localPort}:${containerPort} ${imageID}`

## Specifying working directory
- Start a shell into the container with `docker exec -it ${containerID} sh`
  - If we do `ls` we will see that we've actually copied all of our files (index.js, package.json, package-lock.json etc.) into the root directory of the container!! So does the generated folders like `node_modules`.
  - This is not a best practice, because if we happen to have a folder with the same name with a root folder like `lib`, we might accidentally overwrite some files/folders inside the container.
  - So instead of copying into the root directory inside container, we should change the current working directory with `WORKDIR`


```
FROM node:alpine

# From now on, this will be the current working directory
# for all subsequent instructions, not just inside Dockerfile, 
# but any Docker commands like `docker exec`
# to execute a command inside a container.
WORKDIR /usr/app

COPy ./ ./
RUN npm install

CMD ["npm", "start"]
```

## Unncessary Rebuilds
```
COPY ./ ./
RUN npm install
```

- The problem is with these 2 lines: when we change our source code, the `COPY` instruction would detect the file has changed, so the `COPY` step can't use the cache. The `RUN npm install` after that hence must also be rebuilt, but in fact nothing has changed about the dependencies of our project, only the source code.

- The fix:
```
COPY ./package.json ./
RUN npm install

COPY ./ ./
```
  - By splitting out the COPY like this, `npm install` only needs to be run when there's a change to `package.json`. Source code changes no longer requires a reinstall.
  - 