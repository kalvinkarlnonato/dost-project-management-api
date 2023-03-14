const config = require("./config.json");
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = config.PORT;
var corsOptions = { origin: config.ORIGIN };
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => res.json({ message: "Welcome to website api local." }));
//Users routes
require("./src/routes/user.routes")(app);
//Admin routes
require("./src/routes/admin.routes")(app);
app.get("*", (req, res) => res.json({ error: "page not found" }));
app.listen(PORT, () => console.log("Server is running on port:"+PORT));