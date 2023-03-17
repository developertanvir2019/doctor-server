const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const stripe = require('stripe')('sk_test_51M6AoIBSIlSsQgf2N7eHeJzPmd4aBzcD7V3VIUoqndAjtI7N4MN9x9RKVVabWfL9dRz87r842cRduHEsquEZmyQ500uVhrMSIE');


const app = express();
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.czo9kw9.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const appointmentOption = client.db('doctorsPortal').collection('appointment');
        const BookingCollection = client.db('doctorsPortal').collection('booking');
        const userCollection = client.db('doctorsPortal').collection('user');
        const doctorCollection = client.db('doctorsPortal').collection('doctor');



        app.get('/appointmentOption', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const option = await appointmentOption.find(query).toArray();
            res.send(option)
            //use aggregate to query multiple collection and then merge data
            const bookingQuery = { appointmentDate: date }
            const alreadyBooking = await BookingCollection.find(bookingQuery).toArray();
            option.forEach(opt => {
                const optionBooked = alreadyBooking.filter(book => book.treatment === opt.name)
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = opt.slots.filter(slot => !bookedSlots.includes(slot))
                opt.slots = remainingSlots;
                console.log(date, opt.name, bookedSlots);
            })
        })
        // optional
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;

            const query = { email: email };
            const bookings = await BookingCollection.find(query).toArray();
            res.send(bookings)
        })
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await userCollection.find(query).toArray();
            res.send(users)
        })
        app.get('/special', async (req, res) => {
            const query = {};
            const users = await appointmentOption.find(query).project({ name: 1 }).toArray();
            res.send(users)
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointment: booking.appointmentDate
            }
            const alreadyBooked = await BookingCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `Already added this `
                return res.send({ acknowledged: false, message })
            }
            const result = await BookingCollection.insertOne(booking);
            res.send(result)

        })

        app.post('/createPayment', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;


            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                'payment_method_types': [
                    'card'
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1hr' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result)
        })
        app.post('/doctors', async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result)
        })
        app.get('/doctors', async (req, res) => {
            const query = {};
            const result = await doctorCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await BookingCollection.findOne(query);
            res.send(result)
        })
        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result)
        })
        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })




        // app.get('/priceup', async (req, res) => {
        //     const filter = {};
        //     const option = { upsert: true }
        //     const updateDoc = {
        //         $set: {
        //             price: 106
        //         }
        //     }
        //     const result = await appointmentOption.updateMany(filter, updateDoc, option);
        //     res.send(result)
        // })

    }
    catch (error) {

    }
}
run().catch(console.log(''))
app.get('/', async (req, res) => {
    res.send('doctors portal server is running')
})


app.listen(port, () => console.log('doctors portal server is running on port ', port))
