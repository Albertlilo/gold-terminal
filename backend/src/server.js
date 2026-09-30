const cors = require("cors");
const express = require("express");

const app = express();

app.use(cors());
app.use(express.json({ limit: '16kb' }));
const fredRoutes = require("./routes/fredRoutes");

require("dotenv").config();

const usersRouters = require("./routes/usersRoutes");


app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "API is healthy" });
});

app.get("/", (req,res) => {
    res.json({
        name: "Gold Terminal API",
        version: "1.0.0",
        status: "Running 🚀"
    });
});

app.use("/api/users", usersRouters);

app.use("/api/fred", fredRoutes);
app.use("/api/market", require("./routes/marketRoutes"));
app.use("/api/push", require("./routes/pushRoutes").createPushRouter());

const stopPushScheduler = require("./services/pushRuntime").startScheduler();
process.once('SIGTERM', stopPushScheduler);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
