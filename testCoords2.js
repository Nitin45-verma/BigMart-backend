require('dotenv').config();
const mongoose = require('mongoose');
const Address = require('./src/models/Address');
async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const addrs = await Address.find();
  console.log('Total addresses:', addrs.length);
  for (const addr of addrs) {
    console.log(`Address ID: ${addr._id}`);
    console.log(`Latitude: ${addr.latitude} (typeof: ${typeof addr.latitude})`);
    console.log(`Longitude: ${addr.longitude} (typeof: ${typeof addr.longitude})`);
  }
  mongoose.disconnect();
}
test();
