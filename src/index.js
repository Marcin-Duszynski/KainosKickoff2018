const { Ability, events }       = require('alexa-ability');
const { handleAbility }         = require('alexa-ability-lambda-handler');
const { timeout, TimeoutError } = require('alexa-ability-timeout');
const Twit                      = require('twit')

const twitter = new Twit({
  consumer_key:         process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET
})

const app = new Ability({
  applicationId: process.env.ALEXA_SKILL_ID
});

app.use(timeout(4000));

app.use(function(req, next) {
  console.log('Handling:', req);
  next();
});

app.on(events.launch, function(req, next) {
  const speech = (`
      <speak>
          Hello <break time="100ms" /> world
      </speak>
  `);

  req.say('ssml', speech).send();
});

app.on(events.end, function(req, next) {
  console.log(`Session ended because: ${req.reason}`);
  req.say('Goodbye!').end();
});

app.on(events.help, function(req, next) {
  const speech = (`
      <speak>
          Please say <break time="50ms" /> Check tweets
      </speak>
  `);

  req.say('ssml', speech).send();
});

app.on(events.cancel, function(req, next) {
  if (req.timedOut) return;
  req.say('Cancelling!').end();
});

app.on(events.stop, function(req, next) {
  if (req.timedOut) return;
  req.say('Stopping!').end();
});

app.on('TweetsCountIntent', function(req, next) {
  twitter.get('search/tweets', { q: '#KainosKickoff AND #AskAlexa', lang: 'en', result_type: 'recent', count: 1 }, function(err, data, response) {
    console.log(data)
    console.log(data.statuses[0].text.replace(/#\S+/ig,''))
    console.log(data.statuses[0].id_str)
    console.log(data.search_metadata.refresh_url)
    console.log(data.search_metadata.next_results)

    req.say(data.statuses[0].text.replace(/#\S+/ig,'')).send();
  })
});

app.use(function(req, next) {
  req.say('I don\'t know what to say. Ask about tweets.').end();
});

app.use(function(err, req, next) {
  if (err instanceof TimeoutError) {
    req.say('Sorry, that took to long. Please try again.').send();
  } else {
    req.say('Sorry, something went wrong. Please try again later.').end();
  }
});

exports.handler = handleAbility(app);
