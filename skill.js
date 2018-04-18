const { Ability, events }       = require('alexa-ability');
const { handleAbility }         = require('alexa-ability-lambda-handler');
const { timeout, TimeoutError } = require('alexa-ability-timeout');
const { SQS }                   = require('aws-sdk');

const sqs = new SQS({ apiVersion: '2012-11-05' });
const app = new Ability({
  applicationId: process.env.ALEXA_SKILL_ID
});

app.use(timeout(4000));

app.use((req, next) => {
  console.log('Handling:', req);
  next();
});

app.on(events.launch, (req, next) => {
  console.log('Launch', req);
  
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

app.on(events.end, (req, next) => {
  console.log(`Session ended because: ${req.reason}`);
  req.say('Goodbye!').end();
});

app.on(events.help, (req, next) => {
  const speech = (`
      <speak>
          Please say <break time="50ms" /> Read tweets
      </speak>
  `);

  req.say('ssml', speech).send();
});

app.on(events.cancel, (req, next) => {
  if (req.timedOut) return;
  req.say('Cancelling!').end();
});

app.on(events.stop, (req, next) => {
  if (req.timedOut) return;
  req.say('Stopping!').end();
});

app.on('TweetsReaderIntent', (req, next) => {
  console.log('Intent req', req);

  const params = {
    AttributeNames: [
       'SentTimestamp'
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
       'All'
    ],
    QueueUrl: process.env.TWEETS_SQS_URL
  };

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      console.log('SQS MSG:', data.Messages[0].MessageAttributes);

      const deleteParams = {
        QueueUrl: process.env.TWEETS_SQS_URL,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };

      sqs.deleteMessage(deleteParams, (err, data) => {
        if (err) {
          console.log("Delete Error", err);
        } else {
          console.log("Message Deleted", data);
        }
      });

      const speech = (`
        <speak>
            ${data.Messages[0].MessageAttributes.Author.StringValue} said <break time="50ms" /> ${data.Messages[0].MessageAttributes.Message.StringValue}
        </speak>
      `);
      req.say('ssml', speech).send();
    }
  });
});

app.use((err, req, next) => {
  if (err instanceof TimeoutError) {
    req.say('Sorry, that took to long. Please try again.').send();
  };
});

app.use((req, next) => {
  req.say('I don\'t know what to say. Please try again or ask for help.').end();
});

exports.handler = handleAbility(app);
