# Publishing & pushing checklist

These are the exact steps to make your local changes visible on GitHub and, if
needed, on npm. Follow them whenever you finish a feature or bug fix.

## 1. Verify the working tree

```bash
git status -sb
```

The output should show `## work` (or your current branch) with no staged or
unstaged files. If files are listed, commit them before continuing.

## 2. Confirm or add a remote

```bash
git remote -v
```

If no remotes are configured, add one that points to your GitHub repository:

```bash
git remote add origin git@github.com:<username>/<repo>.git
```

Replace `<username>` and `<repo>` with your actual repository coordinates.

## 3. Push the current branch

```bash
git push origin work
```

Swap `work` for whichever branch you are using. GitHub will immediately show the
latest commit once this command succeeds.

## 4. (Optional) Publish to npm

When you are ready to cut a release, compile the project and publish the
contents of `dist/`:

```bash
npm run build
npm publish
```

The package exposes the `openapi-typescript-client-generator` binary, so users
can invoke the CLI via `npx` or by installing it globally.

Keeping this checklist handy ensures there is no ambiguity about whether the
codebase on GitHub matches your local workspace.
