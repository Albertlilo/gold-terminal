require("dotenv").config();
const express = require("express");
const { installHttpSecurity, safeErrors } = require('./services/httpSecurity');

const app = express();

installHttpSecurity(app);
app.use(express.json({ limit: '16kb' }));
const fredRoutes = require("./routes/fredRoutes");


const usersRouters = require("./routes/usersRoutes");


app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "API is healthy" });
});

app.get("/", (req,res) => {
    res.json({
        name: "Trendline Insight API",
        version: "1.0.0",
        status: "Running 🚀"
    });
});

app.use("/api/users", usersRouters);
app.use('/api/account', require('./routes/accountRoutes'));
app.use('/api/preview', require('./routes/previewRoutes'));

app.use("/api/fred", fredRoutes);
app.use("/api/market", require("./routes/marketRoutes"));
app.use("/api/push", require("./routes/pushRoutes").createPushRouter());
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
app.use(safeErrors);

const stopPushScheduler = require("./services/pushRuntime").startScheduler();
process.once('SIGTERM', stopPushScheduler);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
