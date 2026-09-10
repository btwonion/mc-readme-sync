# mc-readme-sync

A dependency-free GitHub Action that publishes one Markdown file as the long-form project description on CurseForge, Modrinth, or both.

## Usage

Create API tokens on CurseForge and Modrinth, store them as repository secrets, and add a workflow such as:

```yaml
name: Sync project descriptions

on:
  push:
    branches: [main]
    paths: [README.md]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: btwonion/mc-readme-sync@v1
        with:
          modrinth-api-key: ${{ secrets.MODRINTH_API_KEY }}
          curseforge-api-key: ${{ secrets.CURSEFORGE_API_KEY }}
          modrinth-project-id: your-modrinth-slug-or-id
          curseforge-project-id: "123456"
          readme-path: README.md
```

The Modrinth token needs the `PROJECT_WRITE` permission. The CurseForge token must be an author API token from the CurseForge API Tokens page.

To sync only one service, omit both inputs belonging to the other service. For example, a Modrinth-only step is:

```yaml
- uses: btwonion/mc-readme-sync@v1
  with:
    modrinth-api-key: ${{ secrets.MODRINTH_API_KEY }}
    modrinth-project-id: your-modrinth-slug-or-id
    readme-path: README.md
```

When neither service is configured, the action exits successfully without reading the file or making a network request. Supplying only one of a service's API key and project ID is treated as a configuration error.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `modrinth-api-key` | No | Modrinth personal access token with `PROJECT_WRITE` permission. Required with `modrinth-project-id`. |
| `curseforge-api-key` | No | CurseForge author API token. Required with `curseforge-project-id`. |
| `modrinth-project-id` | No | Modrinth slug or project ID. Required with `modrinth-api-key`. |
| `curseforge-project-id` | No | Numeric CurseForge project ID. Required with `curseforge-api-key`. |
| `readme-path` | Yes | Repository-relative Markdown path. Defaults to `README.md`. |

The file path is resolved inside `GITHUB_WORKSPACE`; paths outside the checked-out repository are rejected. Both updates are attempted even when one service returns an error.

## API calls

- CurseForge: `POST https://minecraft.curseforge.com/api/projects/{projectId}/update-project` with an `X-Api-Token` header and `{ "description": "...", "descriptionType": "markdown" }`.
- Modrinth: `PATCH https://api.modrinth.com/v2/project/{id|slug}` with an `Authorization` header and `{ "body": "..." }`.

## Development

Node.js 24 or newer is required locally.

```sh
npm test
```

No install or build step is needed because the action only uses Node.js built-ins.

## License

[MIT](LICENSE)
