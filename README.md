# Wrapper for octokit based CLI tools

The default export of this module is an async getter that will return an initialized and authenticated instance of [OctoKit/Rest][1].

## Secondary utilities

This also exports helper functions

---

### `dispatchEvent(to: string | Ref, eventType: string): Promise<void>`

Dispatch an event to a repository on github.

Parameters:
| Name     | Description                                   | Type                        |
|----------|-----------------------------------------------|-----------------------------|
|to        | A path or resolved reference to a github repo.| `string` \| `RepositoryRef` |
|eventType | See GitHub's [repositroy_dispatch][2] docs.   | `string`                    |

---

### `resolveGithubProject(dir: string): Ref`

Given a directory, resolve the github remote.
Parameters:
| Name | Description           | Type     |
|------|-----------------------|----------|
| dir  | A path to a directory | `string` |

---

#### Type `Ref: object`

Properties:
| Name   | Type     | Description
|--------|----------|---------------
| owner  | `string` | The owner account/organization
| repo   | `string` | The short name of the repository
| repoId | `string` | The Full owner/repo name.

[1]: https://octokit.github.io/rest.js/v18
[2]: https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows#repository_dispatch%20

<style> hr {margin-top: 6em;} </style>
