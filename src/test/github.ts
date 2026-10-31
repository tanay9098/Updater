/**
 * GitHub REST API payloads for tests. Field names and formats follow a real
 * `GET /repos/{owner}/{repo}` response recorded on 2026-10-31 (list
 * endpoints return the same repository shape). Names are fictional except in
 * `RECORDED_REPOSITORY`, which is this project's own public repository.
 */

export const RECORDED_REPOSITORY = {
  id: 1436669665,
  node_id: "R_kgDOVaHW4Q",
  name: "Updater",
  full_name: "tanay9098/Updater",
  private: false,
  owner: { login: "tanay9098", id: 1, type: "User", site_admin: false },
  html_url: "https://github.com/tanay9098/Updater",
  description: null,
  fork: false,
  url: "https://api.github.com/repos/tanay9098/Updater",
  created_at: "2026-10-28T06:02:24Z",
  updated_at: "2026-10-31T08:21:32Z",
  pushed_at: "2026-10-31T08:21:33Z",
  homepage: null,
  size: 812,
  stargazers_count: 0,
  watchers_count: 0,
  language: "TypeScript",
  forks_count: 0,
  archived: false,
  disabled: false,
  open_issues_count: 0,
  license: null,
  topics: [],
  visibility: "public",
  default_branch: "main",
};

let nextId = 5000;

export function githubRepo(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = nextId++;
  const name = (overrides.name as string | undefined) ?? `sample-repo-${id}`;
  return {
    ...RECORDED_REPOSITORY,
    id,
    node_id: `R_${id}`,
    name,
    full_name: `octo-sample/${name}`,
    owner: { login: "octo-sample", id: 2, type: "User", site_admin: false },
    html_url: `https://github.com/octo-sample/${name}`,
    url: `https://api.github.com/repos/octo-sample/${name}`,
    description: "Sample repository description",
    language: "Go",
    topics: ["cli"],
    license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
    ...overrides,
  };
}

export function githubResponse(
  body: unknown,
  { status = 200, headers = {} }: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": "57",
      "x-ratelimit-reset": "1793439172",
      ...headers,
    },
  });
}
