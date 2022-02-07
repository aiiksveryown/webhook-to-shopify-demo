# webhook-to-shopify

## About
This is an app that receives product order data from Thrivecart, parses it and
1. Creates / retrieves the corresponding customer in your shopify store
2. Creates a draft order in shopify.

## Authentication
### Thrivecart
Thrivecart provides a "secret word" so the app (webhook-to-shopify) only accepts requests from your thrivecart account. Secret word can be found in `settings > Thrivecart order validation` in your thrivecart account. 

### Shopify store
Shopify provides a "Shared secret" that is used to authorize API calls to your store. This secret is added to the header of all API requests to shopify. 

## Local Development
`npm i` to install dependencies
`npm start` to start a local server listening for mock requests at port 8080


## Deployment
A bucket `bucket` should be setup to store data for failed orders<br/>
This app is written for Google cloud functions. 
Deploy with <br/>

`gcloud functions deploy thrivecart-webhook-to-shopify --entry-point main --runtime nodejs14 --trigger-http --allow-unauthenticated --env-vars-file env.yaml --memory 128MB --security-level secure-always --timeout 30s`

<br/>

After deployment, the endpoint URL should be retrieved from the `trigger` tab in the cloud function, and added to Thrivecart `settings` > `API & webhooks` > `Webhooks and notifications`

### Environmental Variables
This is setup in the google cloud function Runtime environment variables.<br/>
`tcsecret` = Thrivecart secret word<br/>
`shopAccessToken` = Shopify Shared secret<br/>
`shopUrl` = The url to your shopify store, ie `https://Ogopogo-dev.myshopify.com`<br/>
`slackWebhook`: Slack webhook url to send notification of failed orders

## Usage
The only thing that needs to be set is the environmental variables. 
Thrivecart will send all order/customer data, but the `webhook-to-shopify` app expects a valid/corresponding shopify `variant_id` in the Product label field of your thrivecart products. <br/>

## Logging
Logs of successes/errors can be found in the log tab of the google cloud function. Successful orders will have two entries:
1. `CreateCustomer status: 201 Created` or `RetrieveCustomer Status: 200 OK`
2. `DraftOrder status: 202 Accepted`<br/>

 Failed orders will be saved, and a notification sent to the slack webhook defined.
 
