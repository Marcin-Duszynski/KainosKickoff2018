const { SQS, DynamoDB }   = require('aws-sdk');
const Twit                = require('twit')

const dynamo = new DynamoDB.DocumentClient();
const sqs = new SQS({ apiVersion: '2012-11-05' });

const twitter = new Twit({
  consumer_key:         process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET
});

function getState(context) {
  const params = {
    TableName: process.env.STATE_DB_NAME,
    Key: {
      'function_name': context.functionName
    }
  };

  return new Promise((resolve, reject) => {
    dynamo.get(params, (err, data) => {
      if (err) {
        console.log('Error', err);
        reject(err);
      } else {
        console.log('Success', data.Item);
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
      'function_name': context.functionName,
      'state': state
    }
  };
  return new Promise((resolve, reject) => {
    return dynamo.put(params, (err, data) => {
      if (err) {
        console.log('Error', err);
        reject(err);
      } else {
        console.log('Success', data);
        resolve(data);
      }
    });
  })
}

function SendToQueue(statuses) {
  let entries = [];

  for (let i = 0; i < statuses.length; i++) {
    let msg = statuses[i];

    entries.push({
      Id: msg.id_str,
      MessageBody: JSON.stringify({
        id: msg.id_str,
        author: msg.user.name,
        msg: msg.text.replace(/#\S+/ig,'')
      }),
      MessageAttributes: {
        'Author': {
          DataType: 'String',
          StringValue: msg.user.name
        },
        'Message': {
          DataType: 'String',
          StringValue: msg.text.replace(/#\S+/ig,'')
        }
      }
    })
  }

  const params = {
    Entries: entries,
    QueueUrl: process.env.TWEETS_SQS_URL
  };

  console.log('SQS params', params);

  return new Promise((resolve, reject) => {
    sqs.sendMessageBatch(params, (err, data) => {
      if (err) {
        console.log('Error', err);
        reject(err);
      } else {
        console.log('Success', data);
        resolve(data);
      }
    });
  })
}

function getTweets(last_tweet_id) {
  console.log('Last tweet id', last_tweet_id);

  return new Promise((resolve, reject) => {
    twitter.get('search/tweets', { since_id: last_tweet_id, q: '#KainosKickoff18 AND #AskAlexa', lang: 'en', result_type: 'recent', count: 1000 }, async (err, data, response) => {
      if (err) {
        console.log('Error', err);

        reject(err);
      } else {
        console.log(data);
        await SendToQueue(data.statuses);

        resolve(data.search_metadata.max_id_str);
      }
    });
  });
}

exports.handler = async (event, context) => {
  let state = await getState(context);
  state.last_tweet_id = await getTweets(state.last_tweet_id);

  console.log('State', state);

  return saveState(state, context)
          .then(() => { return { status: 'OK'}})
          .catch(() => { return { status: 'ERROR'}})
};
