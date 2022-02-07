const {Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const _ = require("lodash");

// Import own modules
const error_handling = require('./error_handling')

const shopApiPw = process.env.shopApiPw // Shopify access token / key
const storeDomain = process.env.storeDomain // Shopify store domain

Shopify.Context.API_VERSION = "2022-01"
const client = new Shopify.Clients.Rest(storeDomain, shopApiPw);

exports.createCustomer = async function (req, uuid) {  
  const jsondata = req.body
  
  try {
    var customerData = {}
    customerData = {
      "customer": 
        {
          "email": jsondata.customer.email,
          "first_name": jsondata.customer.first_name,
          "last_name": jsondata.customer.last_name,
          "addresses": [
            {
              "address1": jsondata.customer.address.line1,
              "address2": jsondata.customer.address.line2,
              "country": jsondata.customer.address.country,
              "province": jsondata.customer.address.state,
              "city": jsondata.customer.address.city,
              "zip": jsondata.customer.address.zip,
              "phone": jsondata.customer.contactno
            }
          ],
          "note": "Created from Thrivecart Webhook"
        }
    };

    var data = await client
      .post({
        path: 'customers',
        data: customerData,
        type: DataType.JSON,
        tries: 3
      })
  } catch (error) {
    if (error.code == 422 && error.message.includes('has already been taken')) {
      // If Customer exists, 422 is returned. Handle by just retrieving ID of already existing customer
      return exports.getCustomerID(req, uuid)
    }
    else {
      console.log(uuid, "Create customer failed", error)
      error_handling.storeData(req, uuid, `Create customer ${error.message}`)
      return null
    }
  }
  console.log(uuid, "createCustomer OK")
  return data.body.customer.id
};

exports.getCustomerID = async function (req, uuid) {
  const jsondata = req.body
  try {
    var email = jsondata.customer.email
    var data = await client
      .get({
        path: 'customers/search',
        query: {"query":email},
        tries: 3
      })
    if (data.body.customers[0] === undefined) {
      console.log(uuid, "RetrieveCustomer failed: Not found")
      return null
    }
    console.log(uuid, "RetrieveCustomer OK")
    return data.body.customers[0].id
  } catch (error) {
    console.log(uuid, "RetrieveCustomer failed", error)
    error_handling.storeData(req, uuid, `RetrieveCustomer failed with ${error.message}`)
    return null
  }
} 

exports.createDraftOrder = async function (req, uuid, customerID) {
  const jsondata = req.body
  try {
    var lineItems = jsondata.order.charges
    var line_items = []
    for (item of lineItems) {      
      line_items.push({
        "variant_id": item.label,
        "title": item.name,
        "quantity": item.quantity,
        "requires_shipping": true
      })
    };
    
    // Parse DraftOrder payload
    var orderData = {
      "draft_order": {
        "line_items": line_items,
        "customer": {
          "id": customerID
        },
        "shipping_address": {
          "first_name": jsondata.customer.first_name,
          "last_name": jsondata.customer.last_name,
          "name": jsondata.customer.name,
          "address1": jsondata.customer.shipping_address.line1,
          "address2": jsondata.customer.shipping_address.line2,
          "country": jsondata.customer.shipping_address.country,
          "province": jsondata.customer.shipping_address.state,
          "city": jsondata.customer.shipping_address.city,
          "zip": jsondata.customer.shipping_address.zip,
          "phone": jsondata.customer.contactno ? jsondata.customer.contactno.replace(/[^0-9]/g, '') : ""
        },
        "shipping_line": {
          "price": jsondata.order.charges[0].shipping_amount_str,
          "title": jsondata.order.charges[0].shipping_label
        },
        "note": "Created from Thrivecart Webhook"
      }
    }
    
  } catch (error) {
    console.error(uuid, "Failed to get shipping or item info,", error)
    error_handling.storeData(req, uuid, `Failed to get shipping or item info ${error.message}`)
    return null
  }

  // Init Shopify client

  // Create DraftOrder
  try {
    var data = await client
      .post({
        path: 'draft_orders',
        data: orderData,
        type: DataType.JSON,
        tries: 3
      })
  } catch (error) {
    console.log(uuid, "Create DraftOrder failed", error)
    error_handling.storeData(req, uuid, `Create DraftOrder failed ${error.message}`)
    return null
  }
  console.log(uuid, "Create DraftOrder OK")
  return data.body.draft_order.id
};

exports.completeDraftOrder = async function (req, uuid, draftOrderID, retry) {
  const jsondata = req.body
  // Init Shopify client

  // Complete DraftOrder
  try {
    var data = await client
      .put({
        path: `draft_orders/${draftOrderID}/complete`,
        tries: 1
      })
  } catch (error) {
    
    // Retry if shopify has not finished calculaating
    if (retry < 11 && error.message.includes("This order has not finished calculating, please try again later")) {
      console.log(uuid, "Complete DraftOrder failed:", error.message, " - Retrying")
      return setTimeout(exports.completeDraftOrder, retry*1000, req, uuid, draftOrderID, retry*1.5)
    }
    else {
      console.log(uuid, "Complete DraftOrder failed", error)
      error_handling.storeData(req, uuid, `Complete DraftOrder failed ${error.message}`)
      return null
    }
  }
  console.log(uuid, "Complete DraftOrder OK")
  return data.body.draft_order.id
}
