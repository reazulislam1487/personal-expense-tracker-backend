import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const client = new MongoClient(process.env.MONGODB_URI);

app.use(cors());
app.use(express.json());

let db;
let expensesCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    expensesCollection = db.collection("expenses");
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

connectDB();

app.get("/", (req, res) => {
  res.send("Welcome to the Expense Tracker API");
});
//

// Helper to validate date
function isValidDate(value) {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

// Helper to validate expense data
function validateExpense(data, { partial = false } = {}) {
  const errors = [];
  const payload = {};

  if (!partial || "title" in data) {
    if (typeof data.title !== "string" || data.title.trim().length < 3) {
      errors.push("Title is required and must be at least 3 characters.");
    } else {
      payload.title = data.title.trim();
    }
  }

  if (!partial || "amount" in data) {
    const num = Number(data.amount);
    if (!Number.isFinite(num) || num <= 0) {
      errors.push("Amount is required and must be a number greater than 0.");
    } else {
      payload.amount = num;
    }
  }

  if (!partial || "date" in data) {
    if (!isValidDate(data.date)) {
      errors.push("Date is required and must be a valid date.");
    } else {
      payload.date = new Date(data.date);
    }
  }

  if ("category" in data) {
    payload.category = data.category ? String(data.category).trim() : null;
  }

  return { errors, payload };
}

// ---------------- ROUTES ---------------- //

// GET all expenses
app.get("/expenses", async (req, res) => {
  try {
    const expenses = await expensesCollection
      .find({})
      .sort({ date: -1 })
      .toArray();
    res.json(expenses);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST create new expense
app.post("/expenses", async (req, res) => {
  try {
    const { errors, payload } = validateExpense(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const result = await expensesCollection.insertOne(payload);
    const created = await expensesCollection.findOne({
      _id: result.insertedId,
    });
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH update expense (partial update allowed)
app.patch("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid expense ID" });
    }

    const { errors, payload } = validateExpense(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const result = await expensesCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: payload },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(result.value);
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE expense
app.delete("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid expense ID" });
    }

    const result = await expensesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
