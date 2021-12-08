import { execSync as exec } from 'child_process';

import chalk from 'chalk';
import netrc from 'netrc';
import inquirer from 'inquirer';
import octokit from '@octokit/rest';

let github;
const write = (...args) => console.log(...args);

//#region Internal utilities
 
/**
 * @typedef {Object} RepositoryRef
 * @property {string} owner The owner account/organization
 * @property {string} repo The short name of the repository
 */

/** 
 * @typedef {RepositoryRef} GitHubRepositoryDescription 
 * @property {string} repoId The Full owner/repo name.
 */

/**
 * @private
 * @See https://www.gnu.org/software/inetutils/manual/html_node/The-_002enetrc-file.html
 * @typedef {Object} NetRCEntry
 * @property {string?} machine 
 * @property {string?} account 
 * @property {string?} login 
 * @property {string} password
 * @property {string?} macdef
 */

/**
 * @typedef {Object.<string, NetRCEntry>} NetRC
 */


/**
 * @private
 * @returns {Promise<string>}
 */
async function getToken() {
	/** @type {NetRC} */
	const rc = netrc();
	try {
		const token = rc['github.com']?.password ?? rc['api.github.com']?.password;
		if (!token) {
			throw new Error('No token');
		}

		return token;
	} catch {
		return promptForToken(rc);
	}
}


/**
 * @private
 * @param {NetRC} [rc] 
 * @param {number} [attempts=0]
 * @param {number} [maxAttempts=3]
 * @returns {Promise<string>}
 */
async function promptForToken(rc = netrc(), attempts = 0, maxAttempts = 3) {
	if (attempts >= maxAttempts) {
		// ✗, ✗, ✖, ✕ ?
		write(chalk.reset.bold.red('✕'), chalk.bold.gray('Too many attempts'));
		process.exit(1);
	}

	// TODO: handle password/otp and make a token on the user's behalf?
	const { name, token } = await inquirer.prompt([
		{
			type: 'input',
			message: 'Please enter your github username:',
			name: 'name',
		},
		{
			type: 'password',
			message: 'Please enter your github personal access token:',
			name: 'token',
		},
	]);

	if (await checkCredentials(token)) {
		const { save } = await inquirer.prompt([
			{
				default: false,
				message: 'Save token to config?',
				name: 'save',
				type: 'confirm',
			},
		]);
		if (save) {
			netrc.save({ ...rc, 'github.com': { login: name, password: token } });
		}

		return token;
	}

	return promptForToken(rc, attempts + 1);
}


/**
 * Validates the token
 * 
 * @private
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function checkCredentials(token) {
	try {
		const api = new octokit.Octokit({ auth: `token ${token}` });
		await api.users.getAuthenticated();
		return true;
	} catch (e) {
		write(chalk.reset.bold.red('!'), chalk.bold.gray(e.message));
		return false;
	}
}

//#endregion

/**
 * A helper function to initialize and authenticate an instance of the GitHub API
 * The authentication will resolve from ~/.netrc, and if its not present, will trigger 
 * a prompt to privide it.
 * 
 * @module
 * @returns {Promise<octokit.Octokit>}
 */
export default async function getGithubAPI() {
	if (github) {
		return github;
	}

	let token = await getToken();
	if (!await checkCredentials(token)) {
		token = await promptForToken();
	}

	return new octokit.Octokit({ auth: `token ${token}` });
}


/**
 * Dispatch an event to a repository on github. 
 * 
 * See {@link https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows#repository_dispatch | GitHub's repository_dispatch docs}
 * 
 * @example
 * import { dispatchEvent } from '@jsg2021/github-api';
 * dispatchEvent('./my-project', 'build_staging');
 * 
 * @public
 * @param {string|RepositoryRef} to A path or resolved reference to a github repo.
 * @param {string} eventType See repositroy_dispatch
 * @returns {Promise<void>}
 */
export async function dispatchEvent(to, eventType) {
	const { owner, repo, repoId = [owner, repo].join('/') } =
		typeof to === 'string' ? resolveGithubProject(to) : to;
	const api = await getGithubAPI();
	await api.repos.createDispatchEvent({
		owner,
		repo,
		event_type: eventType,
	});

	return {
		message: `(${repoId}) ${eventType} event dispatched.`,
	};
}


/**
 * Given a directory, resolve the github remote.
 * 
 * @example
 * import { resolveGithubProject } from '@jsg2021/github-api';
 * const details = resolveGithubProject('./my-project');
 * 
 * @public
 * @param {string} dir A path to a directory
 * @returns {GitHubRepositoryDescription}
 */
export function resolveGithubProject(dir = process.cwd()) {
	const run = x =>
		exec(x, { cwd: dir, stdio: 'pipe' }).toString('utf8').trim() || '';
	try {
		const currentBranch = run('git rev-parse --abbrev-ref HEAD');
		// const currentBranch = run('git branch --show-current');
		const remoteBranch = run(
			`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`
		);
		const [origin] = remoteBranch.split('/');
		const url = run(`git remote get-url ${origin}`);
		const [, repoId] = url.match(/github.com[:/](.+?)(?:\.git)?$/i) ?? [];

		const [owner, repo] = repoId?.split('/') ?? [];
		if (!owner || !repo) {
			throw new Error('NOT_GITHUB_REMOTE');
		}
		return {
			owner,
			repo,
			repoId,
		};
	} catch {
		throw new Error('Not in a git repository?');
	}
}
