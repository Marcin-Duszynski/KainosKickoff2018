const Twit  = require('twit')
const AWS   = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

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

function getTweets(last_tweet_id) {
  console.log('Last tweet id', last_tweet_id);

  return new Promise((resolve, reject) => {
    twitter.get('search/tweets', { since_id: last_tweet_id, q: '#KainosKickoff AND #AskAlexa', lang: 'en', result_type: 'recent', count: 1000 }, function(err, data, response) {
      if (err) {
        console.log('Error', err);
        reject(err);
      } else {
        console.log(data);
        // console.log(data.statuses[0].text.replace(/#\S+/ig,''))
        console.log(data.search_metadata.max_id_str);
        console.log(data.search_metadata.refresh_url);
        console.log(data.search_metadata.next_results);

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
