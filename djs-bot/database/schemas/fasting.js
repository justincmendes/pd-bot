const mongoose = require("mongoose");
// const Reminder = require("./reminder");

const fastSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    startTime: Number,
    endTime: Number,
    fastDuration: Number,
    fastBreaker: String,
    mood: Number,
    reflection: String
});

// Middleware for deleteOne, findOneAndDelete, and deleteMany - "this" is not
// returning the deleted document even when using document approach...

// fastSchema.pre('deleteOne', { document: true, query: false }, async (next) => {
//     console.log(this);
//     console.log(`Fast: Removing Associated Reminders (${this._id})...`);
//     const reminderDoc = new Reminder().collection;
//     await reminderDoc.deleteMany({ connectedDocument: this._id });
//     next();
// });

// fastSchema.pre('deleteOne', { document: true, query: false }, async () => {
//     try {
//         const doc = await this.model.findOne(this.getFilter());
//         console.log({doc});
//         console.log(`Fast: Removing Associated Reminders (${doc._id})...`);
//         await Reminder.deleteMany({connectedDocument: doc._id});
//     }
//     catch (err) {
//         console.error(err)
//     }
// });

// fastSchema.pre('deleteOne', { document: false, query: true }, async () => {
//     try {
//         const doc = await this.model.findOne(this.getFilter());
//         console.log({doc});
//         console.log(`Fast: Removing Associated Reminders (${doc._id})...`);
//         await Reminder.deleteMany({connectedDocument: doc._id});
//     }
//     catch (err) {
//         console.error(err)
//     }
// });

// fastSchema.pre('deleteOne', { document: false, query: true }, async (errorLog) => {
//     try {
//         console.log(this);
//         const projectID = this.getFilter()["_id"];
//         console.log({ projectID });
//         console.log(`Fast: Removing Associated Reminders (${projectID})...`);
//         if (projectID) {
//             const deleteReminders = await Reminder.deleteMany({ connectedDocument: this._id });
//             console.log({ deleteReminders });
//         }
//         else {
//             console.log("No _id given...");
//         }
//     }
//     catch (err) {
//         console.error(err)
//     }
// });

module.exports = mongoose.model("Fast", fastSchema, "fasts");
