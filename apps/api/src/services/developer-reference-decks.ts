import type { CardContent } from "@flashcards/domain/content";

import { additionalDeveloperReferenceDefinitions } from "./developer-reference-decks-additional.js";
import { expandedDeveloperReferenceDefinitions } from "./developer-reference-decks-expanded.js";
import {
  type DeveloperReferenceDefinition,
  type DeveloperReferenceId,
  type ReferenceCardSpec,
  developerReferenceIds,
  referenceDeck as deck,
} from "./developer-reference-model.js";

export { developerReferenceIds } from "./developer-reference-model.js";
export type {
  DeveloperReferenceDefinition,
  DeveloperReferenceId,
} from "./developer-reference-model.js";

export type DeveloperReferenceDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    key: string;
    front: CardContent;
    back: CardContent;
  }>;
};

const promptContent = (card: ReferenceCardSpec): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${card.title}`,
        "Open the answer to see the command, its purpose, and a practical example.",
      ].join("\n\n"),
    },
  ],
});

const explanationContent = (card: ReferenceCardSpec): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${card.title}`,
        "### Command or pattern",
        `\`\`\`${card.commandLanguage ?? "bash"}`,
        card.command,
        "```",
        "### What it does",
        card.explanation,
        ...(card.exampleStructure
          ? [
              `### Example ${card.exampleStructureLanguage?.toUpperCase() ?? "structure"}`,
              `\`\`\`${card.exampleStructureLanguage ?? "text"}`,
              card.exampleStructure,
              "```",
            ]
          : []),
        "### Practical example",
        `\`\`\`${card.exampleLanguage ?? "bash"}`,
        card.example,
        "```",
        ...(card.note ? ["### Safety note", card.note] : []),
      ].join("\n\n"),
    },
  ],
});

const gitDefinition: DeveloperReferenceDefinition = {
  id: "git",
  templateKey: "developer:git-reference:v1",
  title: "Git Developer Reference",
  description:
    "Everyday Git commands, advanced history tools, and ten practical development workflows.",
  tags: ["Git", "Version control", "Developer reference"],
  decks: [
    deck(
      "introduction",
      "01 · Git Introduction",
      "The small daily command set that covers most Git work.",
      [
        {
          key: "config",
          title: "Configure your identity",
          command:
            'git config --global user.name "Ada Developer"\ngit config --global user.email ada@example.com',
          explanation:
            "Sets the author identity recorded in new commits. Use repository-local configuration without --global when a project needs a different identity.",
          example: "git config --list --show-origin",
        },
        {
          key: "init",
          title: "Initialize a repository",
          command: "git init",
          explanation:
            "Creates Git metadata for an existing directory without changing the project files.",
          example: "mkdir notes-app\ncd notes-app\ngit init",
        },
        {
          key: "clone",
          title: "Clone a repository",
          command: "git clone <repository-url>",
          explanation:
            "Copies a repository, checks out its default branch, and configures the source as the origin remote.",
          example: "git clone https://example.com/team/app.git\ncd app",
        },
        {
          key: "status",
          title: "Inspect working state",
          command: "git status --short --branch",
          explanation:
            "Shows the current branch plus staged, modified, and untracked files before you create a commit.",
          example: "git status\ngit status --short",
        },
        {
          key: "add",
          title: "Stage selected changes",
          command: "git add <path>",
          explanation:
            "Copies the selected working-tree changes into the staging area for the next commit.",
          example:
            "git add src/login.ts tests/login.test.ts\ngit diff --staged",
        },
        {
          key: "commit",
          title: "Create a commit",
          command: 'git commit -m "Concise change summary"',
          explanation:
            "Records the staged snapshot and advances the current branch.",
          example: 'git commit -m "Validate login email"',
        },
        {
          key: "diff",
          title: "Review changes",
          command: "git diff\ngit diff --staged",
          explanation:
            "Compares unstaged changes with the index, or staged changes with the current commit.",
          example: "git diff -- src/login.ts\ngit diff --staged",
        },
        {
          key: "log",
          title: "Read project history",
          command: "git log --oneline --graph --decorate --all",
          explanation:
            "Displays commits and makes branch relationships visible in a compact history graph.",
          example: "git log -10 --oneline\ngit show HEAD",
        },
        {
          key: "branch",
          title: "List and create branches",
          command: "git branch\ngit branch <name>",
          explanation:
            "Lists local branches or creates a branch pointer without switching the working tree.",
          example: "git branch feature/profile\ngit branch --all",
        },
        {
          key: "switch",
          title: "Switch branches safely",
          command: "git switch <branch>\ngit switch -c <new-branch>",
          explanation:
            "Changes the checked-out branch; -c creates and switches to a new branch in one step.",
          example: "git switch -c feature/profile",
        },
        {
          key: "merge",
          title: "Merge a completed branch",
          command: "git merge <branch>",
          explanation:
            "Integrates another branch into the current branch, creating a merge commit only when necessary.",
          example: "git switch main\ngit merge feature/profile",
        },
        {
          key: "sync",
          title: "Fetch, pull, and push",
          command:
            "git fetch origin\ngit pull --ff-only\ngit push -u origin <branch>",
          explanation:
            "Fetch downloads remote history, pull --ff-only updates without an implicit merge commit, and push publishes local commits.",
          example:
            "git fetch origin\ngit switch main\ngit pull --ff-only\ngit push -u origin feature/profile",
        },
      ],
    ),
    deck(
      "advanced",
      "02 · Git Advanced",
      "Less frequent history editing, recovery, diagnosis, and parallel-work commands.",
      [
        {
          key: "restore-revert",
          title: "Undo without rewriting shared history",
          command: "git restore <path>\ngit revert <commit>",
          explanation:
            "restore discards or unstages local file changes; revert creates a new commit that reverses an existing commit.",
          example: "git restore --staged config.json\ngit revert a1b2c3d",
          note: "Prefer revert for commits already shared with others.",
        },
        {
          key: "stash",
          title: "Temporarily shelve work",
          command: 'git stash push -u -m "work in progress"',
          explanation:
            "Stores tracked and, with -u, untracked changes so you can switch context and restore them later.",
          example:
            'git stash push -u -m "profile draft"\ngit switch main\ngit stash pop',
        },
        {
          key: "rebase",
          title: "Rebase a local branch",
          command: "git rebase <new-base>",
          explanation:
            "Replays local commits on a new base to produce a linear topic-branch history.",
          example: "git fetch origin\ngit rebase origin/main",
          note: "Do not rebase commits that collaborators already use unless the team explicitly coordinates the rewrite.",
        },
        {
          key: "cherry-pick",
          title: "Apply one selected commit",
          command: "git cherry-pick <commit>",
          explanation:
            "Copies the change introduced by a commit onto the current branch as a new commit.",
          example: "git switch release/1.4\ngit cherry-pick a1b2c3d",
        },
        {
          key: "reset",
          title: "Move a local branch pointer",
          command: "git reset --soft|--mixed|--hard <commit>",
          explanation:
            "Moves the current branch and optionally resets the staging area and working tree.",
          example: "git reset --soft HEAD~1",
          note: "--hard discards uncommitted working-tree changes. Inspect status and create a backup branch before destructive resets.",
        },
        {
          key: "reflog",
          title: "Recover a lost commit",
          command: "git reflog",
          explanation:
            "Shows recent local reference movements, including commits no longer reachable from a visible branch.",
          example: "git reflog\ngit switch -c recovery HEAD@{2}",
        },
        {
          key: "bisect",
          title: "Find a regression by binary search",
          command:
            "git bisect start\ngit bisect bad\ngit bisect good <known-good-commit>",
          explanation:
            "Checks out candidate commits so repeated good/bad decisions identify the first faulty commit.",
          example:
            "git bisect start\ngit bisect bad HEAD\ngit bisect good v1.4.0\n# test, then run: git bisect good|bad\ngit bisect reset",
        },
        {
          key: "worktree",
          title: "Work on branches side by side",
          command: "git worktree add <path> <branch>",
          explanation:
            "Adds another working directory linked to the same repository, avoiding repeated branch switching.",
          example:
            "git worktree add ../app-hotfix -b hotfix/login main\ngit worktree list",
        },
      ],
    ),
    deck(
      "samples",
      "03 · Git Practical Samples",
      "Ten copyable workflows for common development and recovery tasks.",
      [
        {
          key: "new-project",
          title: "Sample 1: Start a new repository",
          command: "init → add → commit",
          explanation:
            "Creates a repository and records the initial project snapshot.",
          example:
            'git init\ngit add README.md src/\ngit commit -m "Initial project structure"',
        },
        {
          key: "feature-branch",
          title: "Sample 2: Complete a feature branch",
          command: "switch → add → commit → push",
          explanation: "Keeps a feature isolated and publishes it for review.",
          example:
            'git switch -c feature/search\ngit add src/search.ts tests/search.test.ts\ngit commit -m "Add search filtering"\ngit push -u origin feature/search',
        },
        {
          key: "update-main",
          title: "Sample 3: Update main safely",
          command: "fetch → switch → pull --ff-only",
          explanation:
            "Refreshes remote information and only advances main when no merge commit is required.",
          example: "git fetch origin\ngit switch main\ngit pull --ff-only",
        },
        {
          key: "partial-commit",
          title: "Sample 4: Commit only related files",
          command: "status → diff → add paths → commit",
          explanation:
            "Builds a focused commit while leaving unrelated work untouched.",
          example:
            'git status --short\ngit diff -- src/auth.ts\ngit add src/auth.ts tests/auth.test.ts\ngit commit -m "Reject expired sessions"',
        },
        {
          key: "amend",
          title: "Sample 5: Fix the latest local commit",
          command: "git commit --amend",
          explanation:
            "Adds a forgotten change or edits the latest commit message before the commit is shared.",
          example: "git add docs/setup.md\ngit commit --amend --no-edit",
          note: "Amend rewrites the commit ID; avoid it after collaborators have based work on that commit.",
        },
        {
          key: "undo-published",
          title: "Sample 6: Undo a published change",
          command: "git revert <commit>",
          explanation: "Reverses a shared commit with an auditable new commit.",
          example:
            "git switch main\ngit pull --ff-only\ngit revert a1b2c3d\ngit push origin main",
        },
        {
          key: "resolve-conflict",
          title: "Sample 7: Resolve a merge conflict",
          command: "merge → edit → add → commit",
          explanation:
            "Completes a merge after manually choosing the intended content in conflicted files.",
          example:
            "git merge feature/profile\ngit status\n# edit conflicted files and remove conflict markers\ngit add src/profile.ts\ngit commit",
        },
        {
          key: "inspect-change",
          title: "Sample 8: Find who changed a line",
          command: "git log -S → git blame → git show",
          explanation:
            "Searches history for a text change, attributes current lines, and inspects the relevant commit.",
          example:
            'git log -S"sessionTimeout" --oneline -- src/\ngit blame -L 40,55 src/session.ts\ngit show a1b2c3d',
        },
        {
          key: "recover",
          title: "Sample 9: Recover after an accidental reset",
          command: "reflog → recovery branch",
          explanation:
            "Finds the previous branch tip and protects it with a new branch.",
          example:
            "git reflog\ngit switch -c recovery HEAD@{1}\ngit log --oneline -5",
        },
        {
          key: "release",
          title: "Sample 10: Create an annotated release tag",
          command: "git tag -a → git push",
          explanation:
            "Marks a reviewed commit with release metadata and publishes the tag.",
          example:
            'git switch main\ngit pull --ff-only\ngit tag -a v2.1.0 -m "Release 2.1.0"\ngit push origin v2.1.0',
        },
      ],
    ),
  ],
};

const dockerDefinition: DeveloperReferenceDefinition = {
  id: "docker",
  templateKey: "developer:docker-reference:v1",
  title: "Docker Developer Reference",
  description:
    "Everyday container commands, advanced resource management, and ten practical workflows.",
  tags: ["Docker", "Containers", "Developer reference"],
  decks: [
    deck(
      "introduction",
      "01 · Docker Introduction",
      "The daily commands that cover most local image and container work.",
      [
        {
          key: "version-info",
          title: "Check Docker availability",
          command: "docker version\ndocker info",
          explanation:
            "Shows client/server versions and summarizes the active Docker engine configuration.",
          example:
            "docker version\ndocker info --format '{{json .ServerVersion}}'",
        },
        {
          key: "pull",
          title: "Pull an image",
          command: "docker pull <image>:<tag>",
          explanation:
            "Downloads an image from a registry into the local image cache.",
          example: "docker pull nginx:alpine",
        },
        {
          key: "images",
          title: "List local images",
          command: "docker image ls",
          explanation:
            "Lists image repositories, tags, IDs, creation times, and sizes available locally.",
          example: "docker image ls\ndocker image ls --filter dangling=true",
        },
        {
          key: "run",
          title: "Run a container",
          command: "docker run [options] <image> [command]",
          explanation:
            "Creates and starts a container. Common options name it, publish ports, mount data, and remove it after exit.",
          example:
            "docker run --rm --name web -p 127.0.0.1:8080:80 nginx:alpine",
        },
        {
          key: "ps",
          title: "List containers",
          command: "docker ps\ndocker ps --all",
          explanation:
            "Shows running containers, or all containers including stopped ones with --all.",
          example:
            "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'",
        },
        {
          key: "logs",
          title: "Read container logs",
          command: "docker logs [options] <container>",
          explanation:
            "Reads the process output captured by the container logging driver.",
          example: "docker logs --follow --tail 100 web",
        },
        {
          key: "exec",
          title: "Run a command in a container",
          command: "docker exec [options] <container> <command>",
          explanation:
            "Starts an additional process inside a running container for inspection or maintenance.",
          example: "docker exec -it web sh",
        },
        {
          key: "lifecycle",
          title: "Control container lifecycle",
          command: "docker stop|start|restart <container>",
          explanation:
            "Gracefully stops, starts, or restarts an existing container.",
          example: "docker stop web\ndocker start web\ndocker restart web",
        },
        {
          key: "remove",
          title: "Remove containers and images",
          command: "docker rm <container>\ndocker rmi <image>",
          explanation:
            "Deletes stopped containers or unreferenced local images.",
          example: "docker rm web\ndocker rmi demo-api:local",
          note: "Confirm that the object is no longer needed before removal; use explicit names instead of broad force options.",
        },
        {
          key: "build",
          title: "Build an image",
          command: "docker build -t <name>:<tag> <context>",
          explanation:
            "Builds an image from a Dockerfile and the selected build context.",
          example: "docker build --pull -t demo-api:local .",
        },
        {
          key: "inspect",
          title: "Inspect Docker objects",
          command: "docker inspect OBJECT",
          explanation:
            "Returns low-level JSON configuration and runtime data for containers, images, networks, or volumes.",
          example:
            "docker inspect --format '{{.State.Status}} {{.NetworkSettings.IPAddress}}' web",
        },
        {
          key: "compose",
          title: "Run a Compose application",
          command: "docker compose up -d\ndocker compose down",
          explanation:
            "Creates a multi-service application from Compose configuration and later removes its containers and default network.",
          example:
            "docker compose up --build -d\ndocker compose ps\ndocker compose logs --follow\ndocker compose down",
        },
      ],
    ),
    deck(
      "advanced",
      "02 · Docker Advanced",
      "Less frequent networking, storage, transport, diagnostics, and cleanup commands.",
      [
        {
          key: "networks",
          title: "Manage user-defined networks",
          command: "docker network create|ls|inspect|connect",
          explanation:
            "Creates isolated container networks and connects containers to them by name.",
          example:
            "docker network create app-net\ndocker network connect app-net web\ndocker network inspect app-net",
        },
        {
          key: "volumes",
          title: "Manage persistent volumes",
          command: "docker volume create|ls|inspect|rm",
          explanation:
            "Manages Docker-owned storage whose lifecycle is independent of a container.",
          example:
            "docker volume create pg-data\ndocker volume inspect pg-data",
        },
        {
          key: "stats-events",
          title: "Observe runtime activity",
          command: "docker stats\ndocker events",
          explanation:
            "Streams resource usage or daemon events to diagnose live container behavior.",
          example: "docker stats --no-stream web\ndocker events --since 10m",
        },
        {
          key: "copy",
          title: "Copy files across the container boundary",
          command: "docker cp <source> <destination>",
          explanation:
            "Copies files between the local filesystem and a container without requiring a shell in the image.",
          example: "docker cp web:/var/log/nginx/error.log ./error.log",
        },
        {
          key: "save-load",
          title: "Transfer images offline",
          command: "docker save|load",
          explanation:
            "Serializes one or more images to an archive and restores them on another Docker engine.",
          example:
            "docker save -o demo-api.tar demo-api:1.4\ndocker load -i demo-api.tar",
        },
        {
          key: "buildx",
          title: "Build multi-platform images",
          command: "docker buildx build --platform <platforms>",
          explanation:
            "Uses BuildKit builders to produce images for one or more target architectures.",
          example:
            "docker buildx build --platform linux/amd64,linux/arm64 -t registry.example/demo:1.4 --push .",
        },
        {
          key: "context",
          title: "Switch Docker endpoints",
          command: "docker context ls\ndocker context use <name>",
          explanation:
            "Selects which Docker endpoint subsequent CLI commands address.",
          example: "docker context ls\ndocker context use default",
        },
        {
          key: "disk-cleanup",
          title: "Measure and prune unused data",
          command: "docker system df\ndocker system prune",
          explanation:
            "Reports Docker disk usage and removes stopped containers, unused networks, dangling images, and build cache.",
          example:
            "docker system df\ndocker system prune --filter 'until=168h'",
          note: "Review the report and prune preview carefully. Volumes are not removed unless explicitly requested, because they may contain persistent data.",
        },
      ],
    ),
    deck(
      "samples",
      "03 · Docker Practical Samples",
      "Ten copyable workflows for running, building, debugging, and maintaining containers.",
      [
        {
          key: "web-server",
          title: "Sample 1: Run a disposable web server",
          command: "docker run --rm -p ...",
          explanation:
            "Starts Nginx on a loopback-only host port and removes the container when stopped.",
          example:
            "docker run --rm --name demo-web -p 127.0.0.1:8080:80 nginx:alpine",
        },
        {
          key: "bind-mount",
          title: "Sample 2: Preview local static files",
          command: "docker run --mount type=bind,...",
          explanation:
            "Mounts a local directory read-only into Nginx for a quick browser preview.",
          example:
            'docker run --rm -p 127.0.0.1:8080:80 --mount type=bind,src="$PWD/public",dst=/usr/share/nginx/html,readonly nginx:alpine',
        },
        {
          key: "environment",
          title: "Sample 3: Pass application configuration",
          command: "docker run --env-file ...",
          explanation:
            "Loads environment variables from a file instead of embedding them in an image.",
          example: "docker run --rm --env-file .env.local demo-api:local",
          note: "Keep secret environment files out of version control and restrict their filesystem permissions.",
        },
        {
          key: "debug",
          title: "Sample 4: Debug a running container",
          command: "ps → logs → inspect → exec",
          explanation:
            "Moves from broad status to logs, configuration, and finally an interactive process.",
          example:
            "docker ps --filter name=demo-api\ndocker logs --tail 100 demo-api\ndocker inspect demo-api\ndocker exec -it demo-api sh",
        },
        {
          key: "dockerfile",
          title: "Sample 5: Build a minimal application image",
          command: "docker build -t demo-api:local .",
          explanation:
            "Uses a small production-oriented Dockerfile and then builds it locally.",
          exampleLanguage: "dockerfile",
          example:
            'FROM node:24-alpine\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev\nCOPY . .\nUSER node\nCMD ["node", "server.js"]',
        },
        {
          key: "tag-push",
          title: "Sample 6: Tag and publish an image",
          command: "docker tag → docker push",
          explanation:
            "Adds a registry-qualified tag and uploads the image layers.",
          example:
            "docker tag demo-api:local registry.example/team/demo-api:1.4.0\ndocker push registry.example/team/demo-api:1.4.0",
        },
        {
          key: "compose-stack",
          title: "Sample 7: Start a Compose stack",
          command: "docker compose up --build -d",
          explanation:
            "Builds changed services, starts the stack in the background, and verifies its state.",
          example:
            "docker compose config --quiet\ndocker compose up --build -d\ndocker compose ps\ndocker compose logs --tail 100",
        },
        {
          key: "one-off",
          title: "Sample 8: Run a one-off Compose task",
          command: "docker compose run --rm <service> <command>",
          explanation:
            "Runs a temporary process with a service configuration and removes its container afterward.",
          example: "docker compose run --rm api npm run migrate",
        },
        {
          key: "volume-backup",
          title: "Sample 9: Back up a named volume",
          command: "docker run --rm --mount ... tar ...",
          explanation:
            "Mounts the source volume read-only and writes a compressed archive to a local backup directory.",
          example:
            'docker run --rm --mount type=volume,src=pg-data,dst=/data,readonly --mount type=bind,src="$PWD/backups",dst=/backup alpine tar -czf /backup/pg-data.tgz -C /data .',
        },
        {
          key: "safe-cleanup",
          title: "Sample 10: Review and reclaim disk space",
          command: "docker system df → targeted prune",
          explanation:
            "Measures usage before deleting only old unused objects.",
          example:
            "docker system df\ndocker container prune --filter 'until=168h'\ndocker image prune --filter 'until=168h'",
          note: "Avoid adding --volumes unless you have verified that no persistent data is needed.",
        },
      ],
    ),
  ],
};

const kubernetesDefinition: DeveloperReferenceDefinition = {
  id: "kubernetes",
  templateKey: "developer:kubernetes-reference:v1",
  title: "Kubernetes Developer Reference",
  description:
    "Everyday kubectl commands, advanced cluster operations, and ten practical workflows.",
  tags: ["Kubernetes", "kubectl", "Developer reference"],
  decks: [
    deck(
      "introduction",
      "01 · Kubernetes Introduction",
      "The daily kubectl commands that cover most workload operations.",
      [
        {
          key: "context",
          title: "Check and switch context",
          command:
            "kubectl config current-context\nkubectl config use-context <context>",
          explanation:
            "Shows or changes the cluster and credentials targeted by subsequent kubectl commands.",
          example:
            "kubectl config get-contexts\nkubectl config use-context development",
        },
        {
          key: "cluster-info",
          title: "Inspect cluster endpoints",
          command: "kubectl cluster-info",
          explanation:
            "Displays the control-plane and core service addresses for the active context.",
          example: "kubectl cluster-info\nkubectl version",
        },
        {
          key: "get",
          title: "List resources",
          command: "kubectl get <resource> [name]",
          explanation:
            "Retrieves resource summaries; selectors, namespaces, watch mode, and output formats narrow or enrich the result.",
          example: "kubectl get pods -n app -l app=api -o wide",
        },
        {
          key: "describe",
          title: "Describe a resource",
          command: "kubectl describe <resource> <name>",
          explanation:
            "Shows detailed configuration, status, conditions, and related events for troubleshooting.",
          example: "kubectl describe pod api-7d9f8c6b5-x2abc -n app",
        },
        {
          key: "apply",
          title: "Apply declarative configuration",
          command: "kubectl apply -f <file-or-directory>",
          explanation:
            "Creates or updates resources from version-controlled manifests.",
          example:
            "kubectl apply -f k8s/\nkubectl get deployment,service -n app",
        },
        {
          key: "delete",
          title: "Delete managed resources",
          command: "kubectl delete -f <file>\nkubectl delete <resource> <name>",
          explanation:
            "Requests deletion of resources selected by a manifest, type and name, or label.",
          example: "kubectl delete -f k8s/preview.yaml",
          note: "Confirm the active context and namespace before deleting. Avoid force deletion unless you understand the workload and storage consequences.",
        },
        {
          key: "logs",
          title: "Read container logs",
          command: "kubectl logs <pod> [-c <container>]",
          explanation:
            "Reads logs from a container, with options for following output, previous instances, and label-selected pods.",
          example:
            "kubectl logs -n app deployment/api --all-containers --tail=100\nkubectl logs -n app pod/api-xyz --previous",
        },
        {
          key: "exec",
          title: "Execute a diagnostic command",
          command: "kubectl exec <pod> -- <command>",
          explanation:
            "Starts a process in an existing container for targeted diagnosis.",
          example: "kubectl exec -n app -it pod/api-xyz -- sh",
        },
        {
          key: "port-forward",
          title: "Forward a local port",
          command: "kubectl port-forward <resource> <local>:<remote>",
          explanation:
            "Creates a temporary local tunnel to a pod or service without publishing it externally.",
          example: "kubectl port-forward -n app service/api 8080:80",
        },
        {
          key: "scale",
          title: "Scale a workload",
          command: "kubectl scale <resource> <name> --replicas=<count>",
          explanation:
            "Changes the desired replica count of a scalable workload.",
          example: "kubectl scale deployment/api -n app --replicas=4",
        },
        {
          key: "rollout",
          title: "Monitor and control rollouts",
          command: "kubectl rollout status|restart|undo <resource>",
          explanation:
            "Waits for a rollout, triggers a restart, or rolls back supported workloads.",
          example:
            "kubectl rollout status deployment/api -n app\nkubectl rollout restart deployment/api -n app",
        },
        {
          key: "namespace",
          title: "Create and target namespaces",
          command: "kubectl create namespace <name>\nkubectl ... -n <name>",
          explanation:
            "Creates an isolation scope and explicitly targets it with -n or --namespace.",
          example:
            "kubectl create namespace preview\nkubectl get all -n preview",
        },
      ],
    ),
    deck(
      "advanced",
      "02 · Kubernetes Advanced",
      "Less frequent authorization, mutation, diagnostics, and node-maintenance commands.",
      [
        {
          key: "explain-resources",
          title: "Discover resource schemas",
          command:
            "kubectl api-resources\nkubectl explain <resource>[.<field>]",
          explanation:
            "Lists server-supported resource types and reads field documentation from the active cluster API schema.",
          example:
            "kubectl api-resources --namespaced=true\nkubectl explain deployment.spec.strategy",
        },
        {
          key: "diff-server-side",
          title: "Preview and apply server-side",
          command:
            "kubectl diff -f <path>\nkubectl apply --server-side -f <path>",
          explanation:
            "Shows live differences and uses server-side field ownership when applying declarative configuration.",
          example:
            "kubectl diff -f k8s/\nkubectl apply --server-side --field-manager=platform-team -f k8s/",
        },
        {
          key: "patch",
          title: "Patch one resource field",
          command: "kubectl patch <resource> <name> --type=merge -p '<json>'",
          explanation:
            "Updates selected fields without resubmitting a complete manifest.",
          example:
            'kubectl patch deployment api -n app --type=merge -p \'{"spec":{"replicas":3}}\'',
        },
        {
          key: "metadata",
          title: "Manage labels and annotations",
          command: "kubectl label|annotate <resource> <name> key=value",
          explanation:
            "Adds queryable labels or descriptive annotations to existing resources.",
          example:
            "kubectl label namespace preview owner=platform\nkubectl annotate deployment/api -n app runbook='internal-runbook-id'",
        },
        {
          key: "auth",
          title: "Check authorization",
          command: "kubectl auth can-i <verb> <resource>",
          explanation:
            "Asks the Kubernetes authorization layer whether the current or impersonated identity may perform an action.",
          example:
            "kubectl auth can-i update deployments -n app\nkubectl auth can-i --list -n app",
        },
        {
          key: "top-wait",
          title: "Observe resources and wait for conditions",
          command: "kubectl top pod\nkubectl wait --for=<condition> <resource>",
          explanation:
            "Reads Metrics API usage and blocks until a resource reaches a declared condition or timeout.",
          example:
            "kubectl top pod -n app\nkubectl wait -n app --for=condition=available deployment/api --timeout=120s",
        },
        {
          key: "jsonpath",
          title: "Extract machine-readable fields",
          command: "kubectl get ... -o jsonpath='<expression>'",
          explanation:
            "Prints selected API fields for scripts without parsing the human-readable table output.",
          example:
            "kubectl get pods -n app -o jsonpath='{range .items[*]}{.metadata.name}{\"\\n\"}{end}'",
        },
        {
          key: "node-maintenance",
          title: "Perform controlled node maintenance",
          command:
            "kubectl cordon <node>\nkubectl drain <node> ...\nkubectl uncordon <node>",
          explanation:
            "Stops new scheduling, safely evicts eligible workloads, and returns a node to service after maintenance.",
          example:
            "kubectl cordon worker-3\nkubectl drain worker-3 --ignore-daemonsets\n# perform maintenance\nkubectl uncordon worker-3",
          note: "Review PodDisruptionBudgets, local storage, singleton workloads, and cluster capacity before draining a node.",
        },
      ],
    ),
    deck(
      "samples",
      "03 · Kubernetes Practical Samples",
      "Ten copyable workflows for deployment, diagnosis, rollout, and maintenance.",
      [
        {
          key: "deploy-manifest",
          title: "Sample 1: Deploy an application manifest",
          command: "kubectl apply -f app.yaml",
          explanation:
            "Creates a Deployment and a ClusterIP Service from one version-controlled manifest.",
          exampleLanguage: "yaml",
          example:
            "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: demo-api\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: demo-api\n  template:\n    metadata:\n      labels:\n        app: demo-api\n    spec:\n      containers:\n        - name: api\n          image: registry.example/demo-api:1.4.0\n          ports:\n            - containerPort: 8080\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: demo-api\nspec:\n  selector:\n    app: demo-api\n  ports:\n    - port: 80\n      targetPort: 8080",
        },
        {
          key: "rollout-image",
          title: "Sample 2: Roll out a new image",
          command: "kubectl set image → rollout status",
          explanation:
            "Updates one container image and waits until the Deployment reports a completed rollout.",
          example:
            "kubectl set image deployment/demo-api api=registry.example/demo-api:1.5.0 -n app\nkubectl rollout status deployment/demo-api -n app --timeout=180s",
        },
        {
          key: "rollback",
          title: "Sample 3: Roll back a failed release",
          command: "rollout history → rollout undo",
          explanation:
            "Inspects Deployment revisions, rolls back, and verifies recovery.",
          example:
            "kubectl rollout history deployment/demo-api -n app\nkubectl rollout undo deployment/demo-api -n app\nkubectl rollout status deployment/demo-api -n app",
        },
        {
          key: "crashloop",
          title: "Sample 4: Diagnose a CrashLoopBackOff",
          command: "get → describe → logs --previous",
          explanation:
            "Finds the failing pod, examines events, and reads output from the previous container instance.",
          example:
            "kubectl get pods -n app\nkubectl describe pod demo-api-xyz -n app\nkubectl logs pod/demo-api-xyz -n app --previous",
        },
        {
          key: "local-access",
          title: "Sample 5: Access a service locally",
          command: "kubectl port-forward service/...",
          explanation:
            "Creates a temporary loopback tunnel for testing without changing the Service type.",
          example:
            "kubectl port-forward -n app service/demo-api 8080:80\n# open http://127.0.0.1:8080",
        },
        {
          key: "scale-verify",
          title: "Sample 6: Scale and verify replicas",
          command: "scale → wait → get",
          explanation:
            "Changes desired capacity, waits for availability, and lists the resulting pods.",
          example:
            "kubectl scale deployment/demo-api -n app --replicas=4\nkubectl wait -n app --for=condition=available deployment/demo-api --timeout=120s\nkubectl get pods -n app -l app=demo-api",
        },
        {
          key: "configmap",
          title: "Sample 7: Create configuration from a file",
          command: "kubectl create configmap ... --from-file",
          explanation:
            "Generates declarative YAML locally so configuration can be reviewed before it is applied.",
          example:
            "kubectl create configmap demo-api-config -n app --from-file=application.yaml --dry-run=client -o yaml > k8s/demo-api-config.yaml\nkubectl apply -f k8s/demo-api-config.yaml",
        },
        {
          key: "secret",
          title: "Sample 8: Apply a Secret without a command-line literal",
          command: "kubectl create secret generic ... --from-env-file",
          explanation:
            "Reads values from a protected local file and applies generated YAML through standard input.",
          example:
            "kubectl create secret generic demo-api-secrets -n app --from-env-file=.secrets.env --dry-run=client -o yaml | kubectl apply -f -",
          note: "Do not commit secret files or generated Secret YAML. Kubernetes Secret values are encoded, not automatically encrypted outside your configured cluster protections.",
        },
        {
          key: "namespace-context",
          title: "Sample 9: Set a default namespace for a context",
          command: "kubectl config set-context --current --namespace=<name>",
          explanation:
            "Changes the default namespace of the current context and then verifies both context and namespace.",
          example:
            "kubectl config set-context --current --namespace=app\nkubectl config current-context\nkubectl config view --minify -o jsonpath='{..namespace}{\"\\n\"}'",
        },
        {
          key: "safe-drain",
          title: "Sample 10: Maintain a worker node safely",
          command: "cordon → drain → uncordon",
          explanation:
            "Prevents scheduling, evicts eligible workloads, verifies the node, and restores scheduling after maintenance.",
          example:
            "kubectl get pdb --all-namespaces\nkubectl cordon worker-3\nkubectl drain worker-3 --ignore-daemonsets\nkubectl get node worker-3\n# perform and verify maintenance\nkubectl uncordon worker-3",
          note: "Use an approved maintenance window and verify redundant capacity before eviction. Never add destructive drain flags casually.",
        },
      ],
    ),
  ],
};

export const developerReferenceDefinitions: DeveloperReferenceDefinition[] = [
  gitDefinition,
  dockerDefinition,
  kubernetesDefinition,
  ...additionalDeveloperReferenceDefinitions,
  ...expandedDeveloperReferenceDefinitions,
];

export const developerReferenceDefinition = (
  id: DeveloperReferenceId,
): DeveloperReferenceDefinition =>
  developerReferenceDefinitions.find((definition) => definition.id === id)!;

export const createDeveloperReferenceDeckSeeds = (
  id: DeveloperReferenceId,
): DeveloperReferenceDeckSeed[] => {
  const definition = developerReferenceDefinition(id);
  const root: DeveloperReferenceDeckSeed = {
    key: definition.templateKey,
    title: definition.title,
    description: definition.description,
    parentKey: null,
    cards: [],
  };
  return [
    root,
    ...definition.decks.map((item) => ({
      key: `${definition.templateKey}:${item.key}`,
      title: item.title,
      description: item.description,
      parentKey: root.key,
      cards: item.cards.map((card) => ({
        key: card.key,
        front: promptContent(card),
        back: explanationContent(card),
      })),
    })),
  ];
};

export const developerReferenceCardCount = (id: DeveloperReferenceId): number =>
  developerReferenceDefinition(id).decks.reduce(
    (total, item) => total + item.cards.length,
    0,
  );
