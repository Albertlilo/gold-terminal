const fredRoutes = require("./routes/fredRoutes");

require("dotenv").config();

const usersRouters = require("./routes/usersRoutes");

const express = require("express");
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "API is healthy" });
});

app.use("/api/users", usersRouters);

app.use("/api/fred", fredRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
