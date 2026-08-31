const { Resend } = require("resend");

// ============================================================
// CONFIGURATION
// ============================================================

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is not configured");
}

if (!from) {
  throw new Error("EMAIL_FROM is not configured");
}

const resend = new Resend(apiKey);

// ============================================================
// SEND VERIFICATION EMAIL
// ============================================================

const sendVerificationEmail = async (email, code, firstName) => {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Verify your NaijaFix account",

      html: `
        <!DOCTYPE html>
        <html>
          <body style="
            margin: 0;
            padding: 40px 20px;
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
          ">
            <div style="
              max-width: 500px;
              margin: 0 auto;
              padding: 30px;
              background-color: #ffffff;
              border-radius: 10px;
            ">
              <h2>Verify your NaijaFix account</h2>

              <p>Hello ${firstName || "there"},</p>

              <p>
                Thank you for creating a NaijaFix account.
              </p>

              <p>
                Use the verification code below to verify your email:
              </p>

              <h1 style="
                letter-spacing: 8px;
                text-align: center;
                font-size: 32px;
              ">
                ${code}
              </h1>

              <p>
                This code will expire in <strong>10 minutes</strong>.
              </p>

              <p>
                If you did not create a NaijaFix account,
                you can safely ignore this email.
              </p>

              <p>— The NaijaFix Team</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("========== RESEND ERROR ==========");
      console.error("Name:", error.name);
      console.error("Message:", error.message);
      console.error("Status Code:", error.statusCode);
      console.error("Full Error:", error);
      console.error("==================================");

      throw error;
    }

    console.log("Verification email sent successfully:", data);

    return data;
  } catch (error) {
    console.error("========== EMAIL SERVICE ERROR ==========");
    console.error(error);
    console.error("=========================================");

    throw error;
  }
};
// ============================================================
// SEND PASSWORD RESET EMAIL
// ============================================================

const sendPasswordResetEmail = async (email, code) => {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Reset your NaijaFix password",

      html: `
        <!DOCTYPE html>
        <html>
          <body
            style="
              margin: 0;
              padding: 40px 20px;
              font-family: Arial, sans-serif;
              background-color: #f5f5f5;
            "
          >
            <div
              style="
                max-width: 500px;
                margin: 0 auto;
                padding: 30px;
                background-color: #ffffff;
                border-radius: 10px;
              "
            >
              <h2>Reset your NaijaFix password</h2>

              <p>
                We received a request to reset your NaijaFix password.
              </p>

              <p>
                Use the code below to continue:
              </p>

              <h1
                style="
                  letter-spacing: 8px;
                  text-align: center;
                  font-size: 32px;
                "
              >
                ${code}
              </h1>

              <p>
                This code will expire in <strong>10 minutes</strong>.
              </p>

              <p>
                If you did not request a password reset,
                you can safely ignore this email.
              </p>

              <p>
                — The NaijaFix Team
              </p>
            </div>
          </body>
        </html>
      `,
    });

    // --------------------------------------------------------
    // RESEND RETURNED AN ERROR
    // --------------------------------------------------------

    if (error) {
      console.error("=================================");
      console.error("RESEND PASSWORD RESET EMAIL ERROR");
      console.error("=================================");
      console.error(error);
      console.error("=================================");

      const emailError = new Error("Unable to send password reset email");

      emailError.statusCode = 500;

      throw emailError;
    }

    console.log("Password reset email sent successfully:", data);

    return data;
  } catch (error) {
    console.error("Password reset email service error:", error);

    if (error.statusCode) {
      throw error;
    }

    const emailError = new Error("Unable to send password reset email");

    emailError.statusCode = 500;

    throw emailError;
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
