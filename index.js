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

const { GraphQLClient } = require('@testmail.app/graphql-request');

/* Random function to generate the tags.*/
const randomCharSet = '0123456789abcdefghijklmnopqrstuvwxyz';
const randomString = (length) => {
    let result = '';
    for (let i = length; i > 0; --i) {
        result += randomCharSet[Math.floor(Math.random() * randomCharSet.length)];
    }
    return result;
}

/* Quick-and-dirty sleep promise */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const msInSecond = 1000;
let emailPattern = new RegExp('([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)@inbox\.testmail\.app');

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
class TestMailAppInboxHelper extends Helper {

    constructor(config) {
        super(config);

        this.sleepDelay = (this.config.sleepDelay ? Number(this.config.sleepDelay) : 5) * msInSecond;
        this.tagLength = this.config.tagLength ? Number(this.config.tagLength) : 8;
        this.defaultTimeout = (this.config.defaultTimeout ? Number(this.config.defaultTimeout) : 240) * msInSecond;

        if (!this.config.apiKey) {
            throw new Error('`apiKey` configuration property is not set.');
        }

        if (!this.config.namespace) {
            throw new Error('`namespace` configuration property is not set.');
        }

        this.client = new GraphQLClient('https://api.testmail.app/api/graphql', {
            headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
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
    async haveInbox(email) {

        let tag = randomString(this.tagLength);
        let namespace = this.config.namespace;

        if (email) {
            const match = emailPattern.exec(email);
            if (match && match.length == 3) {
                namespace = match[1];
                tag = match[2];
            } else {
                throw new Error("Invalid email format supplied (must be namespace.tag@inbox.testmail.app).");
            }
        }

        email = `${namespace}.${tag}@inbox.testmail.app`;
        this.lastUsedInbox = {
            tag: tag,
            namespace: namespace,
            timestamp: Date.now(),
            email: email,
            toString: () => {
                return email;
            }
        }

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
    async receiveEmails(inbox, timeout) {

        /* Prepare the timeout */
        if (!timeout) {
            timeout = this.defaultTimeout;
        } else {
            timeout *= msInSecond;
        }

        /* Prepare the inbox */
        if (!inbox) {
            inbox = this.lastUsedInbox;
        }

        if (!inbox || !inbox.tag || !inbox.namespace || !inbox.timestamp) {
            throw new Error("No/invalid inbox argument supplied and no previous inbox has been opened.");
        }

        while (timeout > 0) {
            await sleep(this.sleepDelay);
            timeout -= this.sleepDelay;

            const data = await this.client.request(`{
                inbox (
                    namespace:"${inbox.namespace}"
                    tag:"${inbox.tag}"
                    timestamp_from:${inbox.timestamp}
                ) {
                    result
                    message
                    emails {
                        from
                        subject
                        html
                        text
                    }
                }
            }`);

            if (data && data.inbox && data.inbox.result === "success" && data.inbox.emails && data.inbox.emails.length > 0) {
                inbox.timestamp = Date.now();
                return data.inbox.emails;
            }
        }

        throw new Error(`Did not receive any new email message.`);
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
    async receiveEmail(inbox, timeout) {
        const emails = await this.receiveEmails(inbox, timeout);
        return emails[0];
    }
}

module.exports = TestMailAppInboxHelper;
