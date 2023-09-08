require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// MongoDB connection setup
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const lastClaimSchema = new mongoose.Schema({
  address: String,
  lastClaimed: Date,
});
const LastClaim = mongoose.model("LastClaim", lastClaimSchema);

app.use(bodyParser.json());

// Define your Ethereum provider and faucetPrivateKey here
const modeUrl = "https://sepolia.mode.network/";
const provider = new ethers.providers.JsonRpcProvider(modeUrl);
const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the MODE FAUCET API🥷!" });
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post("/drip", async (req, res) => {
  const recipientAddress = req.body.recipientAddress;

  try {
    const now = Date.now(); // Current timestamp in milliseconds

    let lastClaim = await LastClaim.findOne({ address: recipientAddress });

    if (!lastClaim) {
      // If no document with the address exists, create a new one
      lastClaim = new LastClaim({
        address: recipientAddress,
        lastClaimed: now,
      });
      await lastClaim.save();

      // Send the drip immediately without checking
      const faucetWallet = new ethers.Wallet(faucetPrivateKey, provider);

      const nonce = await faucetWallet.getTransactionCount();
      const gasPrice = ethers.utils.parseUnits("10", "gwei");
      const gasLimit = 21000;
      const amountWei = ethers.utils.parseEther("0.03");

      const transaction = {
        nonce: nonce,
        to: recipientAddress,
        value: amountWei,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      };

      const tx = await faucetWallet.sendTransaction(transaction);
      const receipt = await tx.wait(); // Get the transaction receipt

      // Update the last claimed transaction time
      lastClaim.lastClaimed = now;
      await lastClaim.save();

      return res.status(200).json({
        message: "Transaction successful!",
        receipt: receipt.transactionHash,
      });
    } else {
      // Check if the user can claim the faucet
      const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (
        now - lastClaim.lastClaimed.getTime() <
        twentyFourHoursInMilliseconds
      ) {
        return res
          .status(400)
          .json({ message: "You can only drip once every 24 hours." });
      }

      // Continue with the regular drip process
      const faucetWallet = new ethers.Wallet(faucetPrivateKey, provider);

      const nonce = await faucetWallet.getTransactionCount();
      const gasPrice = ethers.utils.parseUnits("10", "gwei");
      const gasLimit = 21000;
      const amountWei = ethers.utils.parseEther("0.03");

      const transaction = {
        nonce: nonce,
        to: recipientAddress,
        value: amountWei,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      };

      const tx = await faucetWallet.sendTransaction(transaction);
      const receipt = await tx.wait(); // Get the transaction receipt

      // Update the last claimed transaction time
      lastClaim.lastClaimed = now;
      await lastClaim.save();

      return res.status(200).json({
        message: "Transaction successful!",
        receipt: receipt.transactionHash,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: `Error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
