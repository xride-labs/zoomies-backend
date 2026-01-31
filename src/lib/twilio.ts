import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

// Only initialize Twilio client if credentials are properly configured
if (accountSid && authToken && accountSid.startsWith("AC")) {
  try {
    twilioClient = twilio(accountSid, authToken);
    console.log("✅ Twilio client initialized successfully");
  } catch (error) {
    console.warn("⚠️  Failed to initialize Twilio client:", error);
    twilioClient = null;
  }
} else {
  console.warn(
    "⚠️  Twilio credentials not configured. SMS OTP will be disabled.",
  );
  console.warn(
    "   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env",
  );
}

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via SMS using Twilio
 */
export async function sendOTPViaSMS(
  phoneNumber: string,
  otp: string,
): Promise<boolean> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.error(
      "Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER",
    );
    // In development, log the OTP instead
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
      return true;
    }
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: `Your Zoomies verification code is: ${otp}. This code expires in 10 minutes.`,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });
    console.log(`✅ OTP sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Failed to send OTP via SMS:", error);
    return false;
  }
}

/**
 * Verify phone number format (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

export default twilioClient;
