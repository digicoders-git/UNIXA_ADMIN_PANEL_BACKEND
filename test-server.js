import express from "express";
import sliderRoutes from "./routes/sliderRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();
app.use(express.json());

app.use("/api/sliders", sliderRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => res.send("Test server running"));

app.listen(5001, () => console.log("Test server on 5001"));
