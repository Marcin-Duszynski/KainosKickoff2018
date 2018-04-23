const { Ability, events } = require('alexa-ability');
const { handleAbility } = require('alexa-ability-lambda-handler');
const { timeout, TimeoutError } = require('alexa-ability-timeout');
const { SQS } = require('aws-sdk');

const sqs = new SQS({ apiVersion: '2012-11-05' });
const app = new Ability({
  applicationId: process.env.ALEXA_SKILL_ID,
});

app.use(timeout(60000));

app.use((req, next) => {
  console.info('Handling:', req);
  next();
});

app.on(events.launch, (req) => {
  console.info('Launch', req);

  const speech = (`
    <speak>
      I'm ready.
    </speak>
  `);

  req.say('ssml', speech).send();
});

app.on(events.end, (req) => {
  console.info(`Session ended because: ${req.reason}`);

  const speech = (`
    <speak>
      Bye Bye <break time="50ms" /> Kainos
    </speak>
  `);

  req.say('ssml', speech).end();
});

app.on(events.help, (req) => {
  const speech = (`
      <speak>
          Please say <break time="50ms" /> Read question
      </speak>
  `);

  req.say('ssml', speech).send();
});

app.on(events.cancel, (req) => {
  if (req.timedOut) return;
  req.say('Cancelling!').end();
});

app.on(events.stop, (req) => {
  const speech = (`
    <speak>
      Bye Bye <break time="50ms" /> Kainos
    </speak>
  `);

  req.say('ssml', speech).end();
});

app.on('CustomHelpIntent', (req) => {
  const speech = (`
      <speak>
          Please say <break time="50ms" /> Read question
      </speak>
  `);

  req.say('ssml', speech).send();
});

app.on('TweetsReaderIntent', (req) => {
  console.info('Intent req', req);

  let message;

  const params = {
    AttributeNames: [
      'SentTimestamp',
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
      'All',
    ],
    QueueUrl: process.env.TWEETS_SQS_URL,
  };

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      console.error('Receive Error', err);
    } else if (data.Messages) {
      console.info('SQS MSG:', data.Messages[0].MessageAttributes);

      message = {
        author: data.Messages[0].MessageAttributes.Author.StringValue,
        question: data.Messages[0].MessageAttributes.Message.StringValue,
      };

      const deleteParams = {
        QueueUrl: process.env.TWEETS_SQS_URL,
        ReceiptHandle: data.Messages[0].ReceiptHandle,
      };

      sqs.deleteMessage(deleteParams, (error) => {
        if (error) {
          console.error('Delete Error', err);
        } else {
          console.info('Message Deleted', data);
        }
      });
    }

    let speech;
    if (message) {
      speech = (`
        <speak>
          ${message.author} said <break time="50ms" /> ${message.question}
        </speak>
      `);
    } else {
      speech = (`
        <speak>
          No questions to read <break time="100ms" />
          Guys, Please send questions using Twitter <break time="100ms" />
          <amazon:effect name="whispered">Don't be shy</amazon:effect>
        </speak>
      `);
    }

    req.say('ssml', speech).end();
  });
});

app.on('IntroductionIntent', (req) => {
  const speech = (`
    <speak>
      Hello Kainos <break time="100ms" />
      I am Alexa and I can read tweets tagged using <break time="50ms" /> #KainosKickoff18 <break time="50ms" /> and <break time="50ms" /> #AskAlexa <break time="100ms" />
      Try me. Just send tweet with tags from the screen <break time="100ms" />
      Good luck
    </speak>
  `);

  req.say('ssml', speech).send();
});

app.on('AMAZON.NextIntent', (req) => {
  const speech = (`
    <speak>
      Guys, Please send questions using Twitter <break time="100ms" />
      <amazon:effect name="whispered">Don't be shy</amazon:effect>
    </speak>
  `);

  req.say('ssml', speech).send();
});

app.use((err, req) => {
  if (err instanceof TimeoutError) {
    req.say('Sorry, that took to long. Please try again.').send();
  }
});

app.use((req) => {
  req.say('I don\'t know what to say. Please try again or ask for help.').end();
});

exports.handler = handleAbility(app);
