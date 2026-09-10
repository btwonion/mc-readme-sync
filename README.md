# mc-readme-sync

A dependency-free GitHub Action that publishes one Markdown file as the long-form project description on both CurseForge and Modrinth.

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
      - uses: actions/checkout@v4
      - uses: btwonion/mc-readme-sync@v1
        with:
          modrinth-api-key: ${{ secrets.MODRINTH_API_KEY }}
          curseforge-api-key: ${{ secrets.CURSEFORGE_API_KEY }}
          modrinth-project-id: your-modrinth-slug-or-id
          curseforge-project-id: "123456"
          readme-path: README.md
```

The Modrinth token needs the `PROJECT_WRITE` permission. The CurseForge token must be an author API token from the CurseForge API Tokens page.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `modrinth-api-key` | Yes | Modrinth personal access token with `PROJECT_WRITE` permission. |
| `curseforge-api-key` | Yes | CurseForge author API token. |
| `modrinth-project-id` | Yes | Modrinth slug or project ID. |
| `curseforge-project-id` | Yes | Numeric CurseForge project ID. |
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
