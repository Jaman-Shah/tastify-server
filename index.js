require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 5005;

app.use(express.json());
app.use(cookieParser());

// cors configuration

// const corsConfig = {
//   origin: ["http://localhost:5173", "https://tastify-da963.web.app"],
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
// };

// app.use(cors(corsConfig));

app.use(
  cors({
    origin: ["http://localhost:5173", "https://tastify-da963.web.app"],
    credentials: true,
  })
);

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

// middleWares

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.send({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    //to use into vercel this code should not be used
    // await client.connect();

    const foodCollection = client.db("tastify_foodsDB").collection("foods");

    const orderCollection = client.db("tastify_foodsDB").collection("orders");

    const galleryCollection = client
      .db("tastify_foodsDB")
      .collection("gallery");
    const userCollection = client.db("tastify_foodsDB").collection("users");

    /***********************************
     * <------- auth apis start form here ----->>
     ************************************
     */

    // creating jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // removing jwt

    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: "true" });
    });

    /***********************************
     * <-------services apis start form here ----->>
     ************************************
     */

    // all user posting api

    // getting users api
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const { email } = req.body;
      const user = req.body;
      const query = { email: email };
      const email_exist = await foodCollection.findOne(query);
      if (email_exist) {
        return res.send({ message: "Email in use" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // all foods getting api

    app.get("/foods", async (req, res) => {
      const { page, size } = req.query;
      const parseToInt = (num) => parseInt(num);
      const cursor = foodCollection
        .find()
        .skip(parseToInt(page - 1) * parseToInt(size))
        .limit(parseToInt(size));
      const result = await cursor.toArray();
      res.send(result);
    });

    // number of foods counter for pagination

    app.get("/foods/counter", async (req, res) => {
      const counter = await foodCollection.estimatedDocumentCount();
      res.send({ counter });
    });

    // food search api

    app.get("/foods/search", async (req, res) => {
      const name = req.query.name;
      if (!name) {
        const foods = await foodCollection.find().toArray();
        return res.send(foods);
      }
      const filteredFoods = await foodCollection
        .find({
          name: { $regex: name, $options: "i" },
        })
        .toArray();
      res.send(filteredFoods);
    });

    // getting individual food by id

    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await foodCollection.findOne(query);
      res.send(user);
    });

    // get foods by email

    app.get("/foods/:email", async (req, res) => {
      // if (req.params.email !== req.user.email) {
      //   return res.send({ message: "forbidden" });
      // }

      const email = req.params.email;
      const query = { creator_email: email };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // creating a food api

    app.post("/foods", async (req, res) => {
      const food = req.body;
      const result = await foodCollection.insertOne(food);
      res.send(result);
    });

    // delete single food by id

    app.delete("/foods/:id", async (req, res) => {
      const foodId = req.params.id;

      const deleteOfFoodQuery = { _id: new ObjectId(foodId) };

      // deleting a single food by id
      const foodDeleteResult = await foodCollection.deleteOne(
        deleteOfFoodQuery
      );

      // deleting orders related to the food by foodId
      const deleteOfOrderQuery = { id: foodId };
      const orderDeleteResult = await orderCollection.deleteMany(
        deleteOfOrderQuery
      );

      res.send({ foodDeleteResult, orderDeleteResult });
    });

    // updating added food
    app.put("/food/:id", async (req, res) => {
      const id = req.params.id;
      const { name, image, category, quantity, price, origin, description } =
        req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          name,
          image,
          category,
          quantity,
          price,
          origin,
          description,
        },
      };
      const options = { upsert: true };
      const result = await foodCollection.updateOne(
        filter,
        updatedUser,
        options
      );
      res.send(result);
    });

    // getting top sold foods

    app.get("/topsoldfoods", async (req, res) => {
      // getting the foods and orders from database
      const foods = await foodCollection.find().toArray();
      const orders = await orderCollection.find().toArray();
      // console.log("token is", req.cookies.token);
      //removing duplication and sorting orders with descending order based on quantity
      const uniqueOrders = orders
        .reduce((acc, current) => {
          const existing = acc.find((item) => item.id === current.id);
          if (existing) {
            existing.quantity += current.quantity;
          } else {
            acc.push(current);
          }
          return acc;
        }, [])
        .sort((a, b) => b.quantity - a.quantity);

      // creating map for matching the foods and orders
      const foodMap = new Map();
      foods.forEach((food) => {
        foodMap.set(food._id.toString(), food);
      });

      // keeping descending order based on order to foods
      const result = uniqueOrders.map((item) => foodMap.get(item.id));
      const topSix = result.slice(0, 6);
      res.send(topSix);
    });

    // getting  orders by email

    app.get("/orders/:email", async (req, res) => {
      // if (req.params.email !== req.user.email) {
      //   return res.send({ message: "forbidden" });
      // }
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // creating orders api and
    app.post("/orders", async (req, res) => {
      const order = req.body;
      let { quantity, id } = req.body;
      quantity = parseInt(quantity);

      // Inserting the order into the orders collection
      const insertResult = await orderCollection.insertOne(order);

      // decreasing the quantity from the food collection if order complete
      const updateResult = await foodCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { quantity: -quantity } }
      );
      res.send({ insertResult, updateResult });
    });

    // deleting single order by id
    app.delete("/orders/:id", async (req, res) => {
      const orderedId = req.params.id;
      let { quantity, foodId } = req.body;
      quantity = parseInt(quantity);

      const query = { _id: new ObjectId(orderedId) };

      // deleting single order by id
      const deleteResult = await orderCollection.deleteOne(query);

      // updating the quantity in main food item
      const updateResult = await foodCollection.updateOne(
        { _id: new ObjectId(foodId) },
        { $inc: { quantity: +quantity } }
      );

      res.send({ deleteResult, updateResult });
    });

    // gallery data getting api

    app.get("/gallery", async (req, res) => {
      const gallery = await galleryCollection.find().toArray();
      const result = gallery.slice().reverse();
      res.send(result);
    });

    // gallery data posting api

    app.post("/gallery", async (req, res) => {
      const gallery = req.body;
      const result = await galleryCollection.insertOne(gallery);
      res.send(result);
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
