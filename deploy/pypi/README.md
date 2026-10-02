# PyPI publishing (CLI distribution)

Goal: `pip install modelwrecker` works. Publishing uses PyPI Trusted Publishing (OIDC),
so no API token is stored in GitHub. The workflow is `.github/workflows/publish-pypi.yml`.

The first publish is irreversible (it claims the name and releases to the world), so
confirm before you tag.

## One-time setup

1. Check the name is available: open `https://pypi.org/project/modelwrecker/`. If it is
   taken by someone else, pick another distribution name and update `pyproject.toml`
   (`[project].name`) and the CLI docs.
2. On PyPI: Account -> Publishing -> Add a new pending publisher (Trusted Publisher):
   - PyPI project name: `modelwrecker`
   - Owner: your GitHub owner
   - Repository: this repo
   - Workflow name: `publish-pypi.yml`
   - Environment: `pypi`
3. In GitHub: Settings -> Environments -> create an environment named `pypi`
   (optionally add required reviewers so a release needs approval).

## Release a version

```bash
# bump the version in pyproject.toml, commit, then:
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs the offline test suite, builds the sdist + wheel, and publishes to PyPI.

## Notes

- Consider a first release to TestPyPI to verify the pipeline before the real publish.
- The engine extras (providers, attacks, scan, judges, mcp) still install from PyPI as
  `pip install "modelwrecker[all]"` once published.
