const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-netlify-domain.netlify.app', 'http://localhost:3000']
    : true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.post("/ats-check", async (req, res) => {
  try {
    const { resume, jd } = req.body;

    // Use environment variable for AI service URL in production
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
    
    const response = await axios.post(`${aiServiceUrl}/analyze`, {
      resume,
      jd,
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error analyzing ATS");
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});