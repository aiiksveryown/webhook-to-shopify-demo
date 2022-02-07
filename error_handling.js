
const {Storage} = require('@google-cloud/storage');
const fs = require('fs')
const { IncomingWebhook } = require('@slack/webhook');

// Import own modules
const shopifyCalls = require('./shopifyCalls')

const bucketName = 'bucket'
const filePath = '/tmp/order.json'
// var filePath = './order.json' //for local testing

const slackWebhook = process.env.slackWebhook  // Webhook to send notifications about failed orders

const notifySlack = async (data, uuid, e) => {
  var destFileName = `${uuid}.json`
  // Timeframe where logs from this instance will be
  let a = new Date( Date.now() - 1000 * (60 * 5) ).toISOString()
  let b = new Date( Date.now() + 1000 * (60 * 5) ).toISOString()
  try {
    var customerData = {
      "customer": 
        {
          "email": data.customer.email,
          "first_name": data.customer.first_name,
          "last_name": data.customer.last_name,
          "addresses": [
            {
              "address1": data.customer.address.line1,
              "address2": data.customer.address.line2,
              "country": data.customer.address.country,
              "province": data.customer.address.state,
              "city": data.customer.address.city,
              "zip": data.customer.address.zip,
              "phone": data.customer.contactno
            }
          ],
          "note": "Created from Thrivecart Webhook"
        }
    };
  } catch (error) {
    var customerData = {}
  }

  try {
    var orderData = {
      "draft_order": {
        "line_items": data.order.charges,
        "shipping_address": data.shipping_address,
        "note": "Created from Thrivecart Webhook"
      }
    };
  } catch (error) {
    var orderData = {}
  }

  // Slack message to be sent
  slackMessage = {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": `${uuid} Order not created - Thrivecart`,
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": e,
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Customer*"
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Logs"
          },
          "value": "Logs",
          "url": `https://console.cloud.google.com/logs/query;query=textPayload:${uuid};timeRange=${a}%2F${b}`,
          "action_id": "button-action"
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "plain_text",
            "text": JSON.stringify(customerData).replace(/"/g, "'")
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Order*"
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Data"
          },
          "value": "Data",
          "url": `https://console.cloud.google.com/storage/browser/_details/${bucketName}/${destFileName}`,
          "action_id": "button-action"
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "plain_text",
            "text": JSON.stringify(orderData).replace(/"/g, "'")
          }
        ]
      },
      {
        "type": "divider"
      }
    ]
  }

  // Initialize slack client
  const webhook = new IncomingWebhook(slackWebhook);

  // post slack message
  try {
    await webhook.send(slackMessage);
    console.log("post error to slack successful")
  } catch (error) {
    console.error(uuid,"post to slack failed,", error.message)
  }
}

async function storeFailedOrder(jsondata, uuid, e) {
  // Creates a client using Application Default Credentials
  const storage = new Storage();
  var destFileName = `${uuid}.json`
  
  // Upload order data to storage
  try {
    await storage.bucket(bucketName).upload(filePath, {
      destination: destFileName,
    });
    console.log(`${destFileName} uploaded to ${bucketName}`);
  } catch (error) {
    console.log(uuid, "Data upload to storage failed", error.message)
  }

  // Send notification about error to slack
  notifySlack(jsondata, uuid, e)
}

exports.storeData = (req, uuid, e) => {
  // Store order data to local file
  const jsondata = req.body
  try {
    fs.writeFileSync(filePath, JSON.stringify(jsondata, null, 2))
  } catch (error) {
    console.error(uuid,error)
  }
  // Upload order data to gcs
  storeFailedOrder(jsondata, uuid, e)
}
