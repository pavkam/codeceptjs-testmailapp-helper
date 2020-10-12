# Testmail.app helper for CodeceptJS

[CodeceptJs](https://codecept.io) helper for end-to-end testing using the [Testmail.app service](https://testmail.app).
Testmail service does not create disposable inboxes as other services do, but their namespace/tag support allows this helper to simulate
inbox creation.

## Setup

First, create an account with [Testmail.app](https://testmail.app) and obtain your API key and the namespace that you will use for testing.
Then, install the helper using the following command:

```shell
npm i codeceptjs-testmailapp-helper --save
```

Add the helper to your `codecept.conf.js` file:

```js
helpers: {
  Testmail: {
    apiKey: '<testmail.app API key>',
    namespace: '<testmail.app namespace>',
    require: 'codeceptjs-testmailapp-helper'
  },
}
```

## The simplest use case

The following code will allow your test to create a new random inbox and then receive an email:

```js
const inbox = await I.haveInbox();

// Trigger some code that will send an email
await I.needNotification(inbox.email);

// Wait for the email to be received.
const email = await I.receiveEmail();

// check that sender is the expected one.
assert(email.from === "Notifications <notify@company.com>");
```

## Functions

The helper exposes only three functions you should care about. They are listed below.

### `haveInbox()`

Creates a new inbox. The email address is generated using the account namespace, a random tag and the standard testmail.app domain.
The function returns an `inbox` object that you can use later in the other functions.

Example:

```js
const inbox = await I.haveInbox();

// Use the inbox.email to obtain the generated random email.
I.say(`The new email is ${inbox.email}.`);
```

### `haveInbox(email)`

Re-creates an inbox from a given email address. The email address is expected to be using the same account namespace, a tag and the standard testmail.app domain.
The function return an `inbox` object that you can use later in the other functions.

This function is useful to when receiving emails for previously created accounts.

Example:

```js
const inbox = await I.haveInbox("abcde.4347sddsd1@inbox.testmail.app");

// Use the inbox.email to obtain the same email.
I.say(`The new email is ${inbox.email}.`);
```

### `receiveEmails()`

Waits and returns all new emails since the last call to `receiveEmails()`. Note that calling this function without an inbox argument will assume the 
emails are loaded for the inbox that was last created using `haveInbox()` function.

If no emails are retrieved in the given timeout period, an error is raised.

Example:

```js
const emails = await I.receiveEmails();

// use the properties from the email.
assert(emails[0].from === "me");
```

### `receiveEmails(inbox, [timeout])`

Waits for all new emails since last call to `receiveEmails()` for a given inbox. The inbox has to be created beforehand using the `haveInbox()` function.
You can supply a timeout (in seconds) as the last argument to this function.

If no emails are retrieved in the given timeout period, an error is raised.

Example:

```js
const inbox = await I.haveInbox();
// tests ...
const emails = await I.receiveEmails(inbox, 60); // only wait 60 seconds.

// use the properties from the email.
assert(emails[0].from === "me");
```

### `receiveEmail()` / `receiveEmail(inbox, [timeout])`

And, because waiting for multiple emails is not very useful, there is a version of the function that only returns the latest received email.

If no emails are retrieved in the given timeout period, an error is raised.

Example:

```js
const email = await I.receiveEmail();

// use the properties from the email.
assert(email[0].from === "me");
```

### The `email` object

The email object consists from the following properties:

```none
{
    from,
    subject,
    html,
    text
}
```
