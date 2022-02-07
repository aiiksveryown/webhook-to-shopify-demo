require('dotenv').config();

// Import own modules
const shopifyCalls = require('./shopifyCalls')

exports.main = async function (req, res) {
  const uuid = (new Date()).getTime().toString(36)
  // Retrieving environmental variables/secrets. These are set in the google cloud function setup.
  const tcsecret = process.env.tcsecret // Thrivecart Secret
  const jsondata = req.body

  // Proceed if order is relevant and has been authenticated
  if (jsondata.thrivecart_secret == tcsecret) {
    if (jsondata.event == "order.success") {
      // Send OK message to origin
      res.status(200).send("Okay")

      try {
        // Get Customer ID for new customer or retrive ID for existing customer
        shopifyCalls.createCustomer(req, uuid)
        .then(customerID => {
          if (customerID) {
            // Create Draft order and retrieve ID
            shopifyCalls.createDraftOrder(req, uuid, customerID)
            .then(draftOrderID => {
              if (draftOrderID) {
                shopifyCalls.completeDraftOrder(req, uuid, draftOrderID, 2)
              }
              else{console.log(uuid, "draftorder not created, check logs")}
            })
          }
          else {console.log(uuid, "Customer not created, check logs")}
        })
      } catch (error) {
        console.error(uuid, error)
      }
    }
    else {res.status(204).send("")}
  }
  else {
    res.status(200).send("Unauthorized");
  }
};
