const express = require("express");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 5005;

app.use(express.json());

// cors configuration

const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsConfig));

//
//

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kvwwfig.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    //to use into vercel this code should not be used
    // await client.connect();

    const foodCollection = client.db("tastify_foodsDB").collection("foods");
    const orderCollection = client.db("tastify_foodsDB").collection("orders");

    /***********************************
     * <------- apis start form here ----->>
     ************************************
     */

    // all foods getting api

    app.get("/foods", async (req, res) => {
      const cursor = foodCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // get individual food by id

    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await foodCollection.findOne(query);
      res.send(user);
    });

    // get foods by email

    app.get("/foods/:email", async (req, res) => {
      const email = req.params.email;
      const query = { creator_email: email };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // creating a food api

    app.post("/foods", async (req, res) => {
      const food = req.body;
      console.log("food", food);
      const result = await foodCollection.insertOne(food);
      res.send(result);
    });

    // creating orders api
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const { quantity, id } = req.body;

      // Inserting the order into the orders collection
      const insertResult = await orderCollection.insertOne(order);

      // decreasing the quantity from the food collection if order complete
      const updateResult = await foodCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { quantity: -quantity } }
      );

      res.send({ insertResult, updateResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("home route is running");
});

app.listen(port, () => {
  console.log(`server is running at the port ${port}`);
});
