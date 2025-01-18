import mongoose, { Schema } from 'mongoose'

const subscriptionSchema = Schema({
    subscriber: {
        type: Schema.Types.ObjectId, //the one who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, //the one to whom 'subscriber' is subscribing
        ref: "User"
    }

}, {timestamps: true})

export const Subscription = mongoose.model("Subscription", subscriptionSchema)