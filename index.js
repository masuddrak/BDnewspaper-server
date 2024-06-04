const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kaocfbi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // all collection
    const allNewsCollection = client.db("Newspaper").collection("news");
    const usersCollection = client.db("Newspaper").collection("users");
    const publishersCollection = client.db("Newspaper").collection("publishers");
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })
    // all news route
    app.post("/add-news", async (req, res) => {
      const news = req.body
      const result = await allNewsCollection.insertOne(news)
      res.send(result)
    })
    // update article route
    app.patch("/update-article/:id", async (req, res) => {
      const id = req.params.id
      const news = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { ...news }
      }
      const result = await allNewsCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    // get all articel
    app.get("/all-articles", async (req, res) => {
      const result = await allNewsCollection.find().toArray()
      res.send(result)
    })
    // get premium articel
    app.get("/premium-articles", async (req, res) => {
      const allNews=await allNewsCollection.find().toArray()
      const result=allNews.filter(news=>news.isPremium==="premium")
      res.send(result)
    })
    // get a articel
    app.get("/article-details/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await allNewsCollection.findOne(query)
      res.send(result)
    })
    // delete admin a articel
    app.delete("/delete-article/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await allNewsCollection.deleteOne(query)
      res.send(result)
    })
    // my-articles articel
    app.get("/my-articles/:email", async (req, res) => {
      const email = req.params.email
      const query = { "userInfo.email": email }
      const result = await allNewsCollection.find(query).toArray()
      res.send(result)
    })
    // increment view count
    app.patch("/add-count/:id", async (req, res) => {
      const id = req.params.id
      const articel = req.body
      const totalCount = req.body.viewCount + 1
      const query = { _id: new ObjectId(id) }

      const upadteDoc = {
        $set: {
          viewCount: totalCount
        }
      }
      const result = await allNewsCollection.updateOne(query, upadteDoc);
      res.send(result)
    })

    // add user db
    app.put("/user", async (req, res) => {
      const user = req.body
      const filter = { email: user?.email }
      // check already exist user
      const existUser = await usersCollection.findOne(filter)
      if (existUser) {
        // all ready exist user
        return res.send(existUser)
      }
      // add new user db
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamo: Date.now()
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    })
    // get all users
    app.get("/all-users/:email", async (req, res) => {
      const email = req.params.email
      const query = { email }
      const adminUser = await usersCollection.findOne(query)
      if (adminUser.role === "admin") {
        const result = await usersCollection.find().toArray()
        res.send(result)
      }
    })
    // create admin user
    app.patch("/create-add-user/:email", async (req, res) => {
      const email = req.params.email
      const adminStatus = req.body
      const query = { email }
      console.log(adminStatus.status)
      const upadteDoc = {
        $set: { role: adminStatus.status }
      }
      const result = await usersCollection.updateOne(query, upadteDoc)
      res.send(result)
    })
    // is premiu article
    app.patch("/isPremium/:id", async (req, res) => {
      const id = req.params.id
      const ispremiumStatus = req.body.isPremium
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { isPremium: ispremiumStatus }
      }
      const result = await allNewsCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    // approve article
    app.patch("/approve/:id", async (req, res) => {
      const id = req.params.id
      const approveStatus = req.body.status
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: { status: approveStatus }
      }
      const result = await allNewsCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    // update decline status
    app.put("/decline-status/:id", async (req, res) => {
      const id = req.params.id
      const declineCouse = req.body.decline
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const articel = allNewsCollection.findOne(query)
      if (articel) {
        const updateDoc = {
          $set: {
            ...articel,
            decline: declineCouse
          },
        };
        const result = await allNewsCollection.updateOne(query, updateDoc, options)
        res.send(result)
      }
    })
    // get all publisher
    app.get("/publiser", async (req, res) => {
      const result = await publishersCollection.find().toArray()
      res.send(result)
    })
    app.post("/add-publiser", async (req, res) => {
      const publiser = req.body
      const result = await publishersCollection.insertOne(publiser)
      res.send(result)
    })






    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Newspaper..')
})

app.listen(port, () => {
  console.log(`Newspaper is running on port ${port}`)
})
