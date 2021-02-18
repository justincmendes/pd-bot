const mongoose = require("mongoose");
const Reminder = require("../djs-bot/database/schemas/reminder");
const { cancelReminderByConnectedDocument } = require("./reminder");
require("dotenv").config();

module.exports = {

    // START of Mongoose Functions

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {[mongoose.objectId]} objectIDs
     * Delete many by Object ID and each of the associated reminders.
     * _id - field for ObjectId convention (Parent)
     * connectedDocument - field for ObjectId reference to parent document (Child)
     */
    deleteManyByIDAndConnectedReminders: async function (Model, objectIDs) {
        try {
            const query = { _id: { $in: objectIDs } };
            const documents = await Model.find(query);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} documents (${objectIDs}) can be found...`);
                return false;
            }
            else {
                console.log(`Deleting ${Model.modelName} documents (${objectIDs}) and it's associated reminders...`);
                await Model.deleteMany(query);
                documents.forEach(async (document) => {
                    if (document._id) {
                        await cancelReminderByConnectedDocument(document._id);
                        const reminders = await Reminder.deleteMany({ connectedDocument: document._id });
                        if (reminders.deletedCount === 0) {
                            console.log(`No reminders associated to ${document._id.toString()}`);
                        }
                        else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${document._id.toString()}`);
                    }
                });
                return true;
            }
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {import("mongoose").MongooseFilterQuery} query In the form of an object (i.e. - {colour: red, objectType: "Function", count: 5})
     */
    deleteManyAndConnectedReminders: async function (Model, query) {
        try {
            console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
            const documents = await Model.find(query);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} documents found with query: ${query}, can be found...`);
                return false;
            }
            else {
                console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
                if (query) await Model.deleteMany(query);
                documents.forEach(async (document) => {
                    if (document._id) {
                        await cancelReminderByConnectedDocument(document._id);
                        const reminders = await Reminder.deleteMany({ connectedDocument: document._id });
                        if (reminders.deletedCount === 0) {
                            console.log(`No reminders associated to ${document._id.toString()}`);
                        }
                        else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${document._id.toString()}`);
                    }
                });
                return true;
            }

        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {mongoose.objectId} objectID 
     * Delete one by Object ID and each of the associated reminders. Assumed Convention:
     * _id - field for ObjectId convention (Parent)
     * connectedDocument - field for reference to parent document (Child: ObjectId)
     */
    deleteOneByIDAndConnectedReminders: async function (Model, objectID) {
        try {
            const document = await Model.findByIdAndDelete(objectID);
            console.log({ document });
            if (!document) {
                console.log(`No ${Model.modelName} document (${objectID.toString()}) can be found...`);
                return false;
            }
            else {
                console.log(`Deleting ${Model.modelName} document (${objectID.toString()}) and it's associated reminders...`);
                if (document._id) {
                    await cancelReminderByConnectedDocument(document._id);
                    const reminders = await Reminder.deleteMany({ connectedDocument: document._id });
                    if (reminders.deletedCount === 0) {
                        console.log(`No reminders associated to ${document._id.toString()}`);
                    }
                    else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${document._id.toString()}`);
                }
                return true;
            }
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {import("mongoose").MongooseFilterQuery} query In the form of an object (i.e. - {colour: red, objectType: "Function", count: 5})
     */
    deleteOneAndConnectedReminders: async function (Model, query) {
        try {
            console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
            const document = await Model.findOneAndDelete(query);
            console.log({ documents: document });
            if (!document) {
                console.log(`No ${Model.modelName} document found with query: ${query}, can be found...`);
                return false;
            }
            else {
                console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
                await cancelReminderByConnectedDocument(document._id)
                const reminders = await Reminder.deleteMany({ connectedDocument: document._id });
                const deletedCount = reminders.deletedCount;
                if (deletedCount === 0) {
                    console.log(`No reminders associated to ${document._id.toString()}`);
                }
                else console.log(`Deleted ${deletedCount} reminders associated to ${document._id.toString()}`);
                return true;
            }
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    // END of Mongoose Functions

}