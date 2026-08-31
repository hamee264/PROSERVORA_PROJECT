require("dotenv").config();

console.log(
  "Paystack key loaded:",
  process.env.PAYSTACK_SECRET_KEY
    ? `${process.env.PAYSTACK_SECRET_KEY.substring(0, 8)}...`
    : "MISSING",
);

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
