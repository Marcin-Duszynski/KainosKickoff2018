const { SQS, DynamoDB } = require('aws-sdk');
const Twit = require('twit');

const dynamo = new DynamoDB.DocumentClient();
const sqs = new SQS({ apiVersion: '2012-11-05' });

const twitter = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

function getState(context) {
  const params = {
    TableName: process.env.STATE_DB_NAME,
    Key: {
      function_name: context.functionName,
    },
  };

  return new Promise((resolve, reject) => {
    dynamo.get(params, (err, data) => {
      if (err) {
        console.error('Error', err);
        reject(err);
      } else {
        console.info('Success', data.Item);
        if (data.Item && data.Item.state) {
          resolve(data.Item.state);
        } else {
          resolve({ last_tweet_id: 0 });
        }
      }
    });
  });
}

function saveState(state, context) {
  const params = {
    TableName: process.env.STATE_DB_NAME,
    Item: {
      function_name: context.functionName,
      state,
    },
  };

  return new Promise((resolve, reject) => dynamo.put(params, (err, data) => {
    if (err) {
      console.error('Error', err);
      reject(err);
    } else {
      console.info('Success', data);
      resolve(data);
    }
  }));
}

function SendToQueue(statuses) {
  const entries = [];

  for (let i = 0; i < statuses.length; i += 1) {
    const msg = statuses[i];

    entries.push({
      Id: msg.id_str,
      MessageBody: JSON.stringify({
        id: msg.id_str,
        author: msg.user.name,
        msg: msg.text.replace(/#\S+/ig, ''),
      }),
      MessageAttributes: {
        Author: {
          DataType: 'String',
          StringValue: msg.user.name,
        },
        Message: {
          DataType: 'String',
          StringValue: msg.text.replace(/#\S+/ig, ''),
        },
      },
    });
  }

  if (entries.length > 0) {
    const params = {
      Entries: entries,
      QueueUrl: process.env.TWEETS_SQS_URL,
    };

    console.info('SQS params', params);

    return new Promise((resolve, reject) => {
      sqs.sendMessageBatch(params, (err, data) => {
        if (err) {
          console.error('Error', err);
          reject(err);
        } else {
          console.info('Success', data);
          resolve(data);
        }
      });
    });
  }
}

function getTweets(lastTweetId) {
  console.info('Last tweet id', lastTweetId);

  return new Promise((resolve, reject) => {
    twitter.get('search/tweets', {
      since_id: lastTweetId, q: '#KainosKickoff18 AND #AskAlexa', lang: 'en', result_type: 'recent', count: 1000,
    }, async (err, data) => {
      if (err) {
        console.error('Error', err);

        reject(err);
      } else {
        console.info(data);
        await SendToQueue(data.statuses);

        resolve(data.search_metadata.max_id_str);
      }
    });
  });
}

exports.handler = async (event, context) => {
  const state = await getState(context);
  state.last_tweet_id = await getTweets(state.last_tweet_id);

  console.info('State', state);

  return saveState(state, context).then(() => ({ status: 'OK' })).catch(() => ({ status: 'ERROR' }));
};
