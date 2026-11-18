# Contributing

Thanks for wanting to help with Kiln. Bug reports, small fixes and ideas are all welcome.

## Reporting a bug

Open an issue with the bug template. The most useful things to include are your OS, the Kiln version (Settings, at the bottom), what you did, and what happened. If an instance is involved, the log from its Logs tab usually explains a lot.

## Suggesting a feature

Open an issue with the feature template and describe the problem you're trying to solve. Kiln stays small on purpose, and it will never sign in or start the game itself, so ideas that need either of those probably won't fit.

## Working on the code

You need Node.js 22 or newer.

```sh
npm install
npm run dev
```

Before opening a pull request, run:

```sh
npm run typecheck
npm test
npm run test:e2e
```

A few things that keep the project easy to work on:

- Keep pull requests focused on one change.
- Commit messages are short and lowercase, in conventional style: `fix: keep pinned instances at the top`.
- Write UI text the way you'd explain it to a friend. Buttons say what they do, and errors say what went wrong and how to fix it.
- Kiln only ever writes to `launcher_profiles.json` in the launcher's folder, and backs it up first. Changes that touch anything else in that folder won't be merged.

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
