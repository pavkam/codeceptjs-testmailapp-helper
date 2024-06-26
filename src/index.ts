/*
    MIT License

    Copyright (c) 2020 Alexandru Ciobanu (alex+git@ciobanu.org)

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

import { GraphQLClient } from '@testmail.app/graphql-request';
import { Helper } from 'codeceptjs';
import { randomString, sleep } from './util/common';

const msInSecond = 1000;
const emailPattern = /([a-zA-Z0-9]+).([a-zA-Z0-9]+)@inbox.testmail.app/;

/**
 * Adds support for end-to-end email testing using [Testmail.app](https://testmail.app/).
 * You need an account with Testmail.app to use this helper.
 *
 * The minimum configuration for this helper looks as follows:
 *
 * ```js
 * helpers: {
 *   Testmail: {
 *     apiKey: '<testmail.app API key>',
 *     namespace: '<testmail.app namespace>',
 *     require: 'codeceptjs-testmailapp-helper'
 *   },
 * }
 * ```
 * > Use .env file and environment variables to store sensitive data like API keys
 *
 * ## Configuration
 *
 * * `apiKey` (required) - API key from testmail.app service.
 * * `namespace` (required) - namespace from testmail.app service.
 * * `sleepDelay` (default: 5) - time to wait between trying to load emails (in seconds).
 * * `defaultTimeout` (default: 240) - time to wait for emails (in seconds).
 * * `tagLength` (default: 8) - the length of your randomly generated tags (format: [a-Z0-9]+).
 *
 */
class TestMailAppHelper extends Helper {
	private config: any;
	private sleepDelay: number;
	private tagLength: number;
	private defaultTimeout: number;
	private client: any;
	private lastUsedInbox:
		| {
				namespace: any;
				toString: () => string | null;
				tag: string;
				email: string;
				timestamp: number;
		  }
		| undefined;

	constructor(config: any) {
		super(config);

		this.sleepDelay =
			(this.config.sleepDelay ? Number(this.config.sleepDelay) : 5) *
			msInSecond;
		this.tagLength = this.config.tagLength ? Number(this.config.tagLength) : 8;
		this.defaultTimeout =
			(this.config.defaultTimeout ? Number(this.config.defaultTimeout) : 240) *
			msInSecond;

		if (!this.config.apiKey) {
			throw new Error('`apiKey` configuration property is not set.');
		}

		if (!this.config.namespace) {
			throw new Error('`namespace` configuration property is not set.');
		}

		this.client = new GraphQLClient('https://api.testmail.app/api/graphql', {
			// @ts-ignore
			headers: { Authorization: `Bearer ${this.config.apiKey}` },
		});
	}

	/**
	 * Defines/creates a new inbox by generating a new tag.
	 * If `email` argument is supplied, it is used to create the inbox. The format of the email
	 * should be as follows: `namespace.tag@inbox.testmail.app`.
	 *
	 * The function returns the new inbox and also sets it as "current".
	 *
	 * ```js
	 * const inbox = await I.haveInbox();
	 * ```
	 * or ...
	 * ```js
	 * const inbox = await I.haveInbox("abcde.123456789@inbox.testmail.app");
	 * ```
	 *
	 * @param {string?} email to  create the inbox
	 *
	 */
	async haveInbox(email: string | null) {
		let tag = randomString(this.tagLength);
		let namespace = this.config.namespace;
		let currentEmail = email;

		if (currentEmail) {
			const match = emailPattern.exec(currentEmail);
			if (match && match.length === 3) {
				namespace = match[1];
				tag = match[2];
			} else {
				throw new Error(
					'Invalid email format supplied (must be namespace.tag@inbox.testmail.app).',
				);
			}
		}

		currentEmail = `${namespace}.${tag}@inbox.testmail.app`;

		this.lastUsedInbox = {
			tag: tag,
			namespace: namespace,
			timestamp: Date.now(),
			email: currentEmail,
			toString: () => {
				return currentEmail;
			},
		};

		return this.lastUsedInbox;
	}

	/**
	 * Receives all new emails since last call to `receiveEmails` for the given inbox.
	 * If `timeout` argument is supplied, it will override the default timeout (in seconds).
	 * If the `inbox` argument is not supplied, the last created inbox will be used.
	 *
	 * If no emails are received, an error is raised.
	 *
	 * ```js
	 * const emails = await I.receiveEmails();
	 * ```
	 * or ...
	 * ```js
	 * const emails = await I.receiveEmails(inbox, 100);
	 * ```
	 *
	 * @param {*} inbox
	 * @param {number?} timeout
	 *
	 */
	async receiveEmails(inbox: any, timeout: number) {
		let currentInbox = inbox;
		let currentTimeout = timeout;

		/* Prepare the timeout */
		if (!currentTimeout) {
			currentTimeout = this.defaultTimeout;
		} else {
			currentTimeout *= msInSecond;
		}

		/* Prepare the inbox */
		if (!currentInbox) {
			currentInbox = this.lastUsedInbox;
		}

		if (
			!currentInbox ||
			!currentInbox.tag ||
			!currentInbox.namespace ||
			!currentInbox.timestamp
		) {
			throw new Error(
				'No/invalid inbox argument supplied and no previous inbox has been opened.',
			);
		}

		while (currentTimeout > 0) {
			await sleep(this.sleepDelay);
			currentTimeout -= this.sleepDelay;

			const data = await this.client.request(`{
                inbox (
                    namespace:"${currentInbox.namespace}"
                    tag:"${currentInbox.tag}"
                    timestamp_from:${currentInbox.timestamp}
                ) {
                    result
                    message
                    emails {
                        from
                        subject
                        html
                        text
                        attachments {
                          filename
                          contentType
                          downloadUrl
                        }
                    }
                }
            }`);

			if (
				data?.inbox &&
				data.inbox.result === 'success' &&
				data.inbox.emails &&
				data.inbox.emails.length > 0
			) {
				currentInbox.timestamp = Date.now();
				return data.inbox.emails;
			}
		}

		throw new Error('Did not receive any new email message.');
	}

	/**
	 * Receives all the first new email since last call to `receiveEmail` for the given inbox.
	 * If `timeout` argument is supplied, it will override the default timeout (in seconds).
	 * If the `inbox` argument is not supplied, the last created inbox will be used.
	 *
	 * If no emails are received, an error is raised.
	 *
	 * ```js
	 * const email = await I.receiveEmail();
	 * ```
	 * or ...
	 * ```js
	 * const email = await I.receiveEmail(inbox, 100);
	 * ```
	 *
	 * @param {*} inbox
	 * @param {number?} timeout
	 *
	 */
	async receiveEmail(inbox: any, timeout: number) {
		const emails = await this.receiveEmails(inbox, timeout);
		return emails[0];
	}
}

export = TestMailAppHelper;
