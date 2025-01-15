import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import connectDB from "./db/index.js";
import { app } from './app.js';

connectDB()
.then(()=>{
    app.listen(process.env.PORT, ()=>{
        console.log("The app is listening on port: ", process.env.PORT)
    })
})
.catch((error)=>{
    console.log("Mongo DB Connection Error : ", error)
})


//import routers
import userRouter from './routes/user.routes.js'

app.use("/api/v1/users", userRouter)