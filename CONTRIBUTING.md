# Contributing Guidelines

Thank you for your interest in contributing to our repository! Whether it's a bug
report, new feature, question, or additional documentation, we greatly value
feedback and contributions from our community. Read through this document
before submitting any issues or pull requests to ensure we have all the
necessary information to effectively respond to your bug report or
contribution.

In addition to this document, please review our [Code of
Conduct](CODE_OF_CONDUCT.md). For any code of conduct questions or comments
please email oss@splunk.com.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest
features. When filing an issue, please check existing open, or recently closed,
issues to make sure somebody else hasn't already reported the issue. Please try
to include as much information as you can. Details like these are incredibly
useful:

- A reproducible test case or series of steps
- The version of our code being used
- Any modifications you've made relevant to the bug
- Anything unusual about your environment or deployment
- Any known workarounds

When filing an issue, please do *NOT* include:

- Internal identifiers such as JIRA tickets
- Any sensitive information related to your environment, users, etc.

## Documentation

The Splunk Observability documentation is hosted at https://docs.splunk.com/Observability,
which contains all the prescriptive guidance for Splunk Observability products. 
Prescriptive guidance consists of step-by-step instructions, conceptual material,
and decision support for customers. Reference documentation and development 
documentation is hosted on this repository.

You can send feedback about Splunk Observability docs by clicking the "Feedback" 
button on any of our documentation pages on the official docs site.

## Reporting Security Issues

See [SECURITY.md](SECURITY.md#reporting-security-issues) for detailed instructions.

## Contributing via Pull Requests

Contributions via Pull Requests (PRs) are much appreciated. Before sending us a
pull request, please ensure that:

1. You are working against the latest source on the `main` branch.
2. You check existing open, and recently merged, pull requests to make sure
   someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your
   time to be wasted.
4. You submit PRs that are easy to review and ideally less 500 lines of code.
   Multiple PRs can be submitted for larger contributions.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please ensure a single change per PR. If you also
   reformat all the code, it will be hard for us to focus on your change.
3. Ensure local tests pass and add new tests related to the contribution.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request
   interface.
6. Pay attention to any automated CI failures reported in the pull request, and
   stay involved in the conversation.

GitHub provides additional documentation on [forking a
repository](https://help.github.com/articles/fork-a-repo/) and [creating a pull
request](https://help.github.com/articles/creating-a-pull-request/).

## Finding contributions to work on

Looking at the existing issues is a great way to find something to contribute
on. As our repositories, by default, use the default GitHub issue labels
(enhancement/bug/duplicate/help wanted/invalid/question/wontfix), looking at
any 'help wanted' issues is a great place to start.

## Building

```bash
npm install
npm run compile
```

## Functional tests
2 nightwatch configurations are present in this repository:
1. local Selenium-based, non-parallel, multi-browser
1. remote browserstack-based, Selenium-based, semi-parallel (BrowserStack provides parallelization), multi-browser

To explore all options see `package.json`. The easiest way to start is with `npm run test:integration:local` (you need Google Chrome for this).

### Executing integration tests from your own machine
1. Copy `.env.example` as `.env`
1. Fill in `BROWSERSTACK_USER` and `BROWSERSTACK_KEY`
1. `npm run test:integration`

### SSL certs
Some of the features, we're testing for, require safe context, which means that `http://localhost` is not sufficient for these features to be enabled, and HTTPS is required. For your convenience dummy self-signed certs are provided out of the box and Selenium is configured to disable SSL verification.

### Local tunnel/proxy
By running BrowserStack-based tests you are exposing your local network to the test runner. Please see `integration-tests/utils/browserstack.runner.js` for more details.

### Safari
Requires the code below to be run once, to enable running integration tests in Safari locally.

```bash
$ /usr/bin/safaridriver --enable
```

## Licensing

See the [LICENSE](LICENSE) file for our repository's licensing. We will ask you to
confirm the licensing of your contribution.

We may ask you to sign a [Contributor License Agreement
(CLA)](http://en.wikipedia.org/wiki/Contributor_License_Agreement) for larger
changes.
